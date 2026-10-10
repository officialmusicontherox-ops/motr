import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

/**
 * Traffic, including the people who never pressed anything.
 *
 * Fan counts answer "how many started swiping". This answers the question
 * underneath it: does anyone arrive at all, and do they go any further than
 * the first screen.
 */
export const dynamic = "force-dynamic";

function since(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const d1 = since(1);
  const d7 = since(7);
  const d30 = since(30);

  const [views, viewers, v1, v7, v30, people1, people7, people30, fromShare, paths, referrers, countries, funnel] =
    await Promise.all([
      prisma.visit.count(),
      prisma.visit.findMany({ distinct: ["visitorId"], select: { visitorId: true } }).then((r) => r.length),
      prisma.visit.count({ where: { createdAt: { gte: d1 } } }),
      prisma.visit.count({ where: { createdAt: { gte: d7 } } }),
      prisma.visit.count({ where: { createdAt: { gte: d30 } } }),
      prisma.visit.findMany({ where: { createdAt: { gte: d1 } }, distinct: ["visitorId"], select: { visitorId: true } }).then((r) => r.length),
      prisma.visit.findMany({ where: { createdAt: { gte: d7 } }, distinct: ["visitorId"], select: { visitorId: true } }).then((r) => r.length),
      prisma.visit.findMany({ where: { createdAt: { gte: d30 } }, distinct: ["visitorId"], select: { visitorId: true } }).then((r) => r.length),
      prisma.visit.count({ where: { fromShare: true } }),

      prisma.visit.groupBy({
        by: ["path"],
        _count: { path: true },
        orderBy: { _count: { path: "desc" } },
        take: 8,
      }),
      prisma.visit.groupBy({
        by: ["referrer"],
        where: { NOT: { referrer: null } },
        _count: { referrer: true },
        orderBy: { _count: { referrer: "desc" } },
        take: 8,
      }),
      prisma.visit.groupBy({
        by: ["country"],
        where: { NOT: { country: null } },
        _count: { country: true },
        orderBy: { _count: { country: "desc" } },
        take: 8,
      }),

      // How many of the people who landed on the front page went on to start
      // listening. Counting page views could not answer this: the whole swipe
      // screen lives at "/", so somebody who swiped two hundred times sent
      // exactly one view and looked identical to somebody who left at once.
      //
      // Two aggregates compared over the same window, never a join: Visit is
      // deliberately not linked to Fan, and it stays that way.
      Promise.all([
        prisma.visit
          .findMany({ where: { path: "/" }, distinct: ["visitorId"], select: { visitorId: true } })
          .then((r) => r.length),
        prisma.visit.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      ]).then(async ([landed, firstEver]) => {
        if (!firstEver) return { landed, started: 0 };
        return {
          landed,
          started: await prisma.fan.count({ where: { createdAt: { gte: firstEver.createdAt } } }),
        };
      }),
    ]);

  return NextResponse.json({
    totals: { views, viewers, fromShare },
    windows: {
      day: { views: v1, viewers: people1 },
      week: { views: v7, viewers: people7 },
      month: { views: v30, viewers: people30 },
    },
    funnel: {
      landed: funnel.landed,
      started: funnel.started,
      rate: funnel.landed ? Math.round((funnel.started / funnel.landed) * 100) : null,
    },
    paths: paths.map((p) => ({ path: p.path, views: p._count.path })),
    referrers: referrers.map((r) => ({ host: r.referrer, views: r._count.referrer })),
    countries: countries.map((c) => ({ country: c.country, views: c._count.country })),
  });
}
