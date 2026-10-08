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

  const [views, viewers, v1, v7, v30, people1, people7, people30, fromShare, paths, referrers, countries, bounce] =
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

      // A browser that sent exactly one view looked at one screen and left.
      prisma.$queryRaw<{ once: bigint; total: bigint }[]>`
        SELECT COUNT(*) FILTER (WHERE n = 1)::bigint AS once, COUNT(*)::bigint AS total
        FROM (SELECT "visitorId", COUNT(*) AS n FROM "Visit" GROUP BY "visitorId") s
      `,
    ]);

  const b = bounce[0];
  const total = Number(b?.total ?? 0);

  return NextResponse.json({
    totals: { views, viewers, fromShare },
    windows: {
      day: { views: v1, viewers: people1 },
      week: { views: v7, viewers: people7 },
      month: { views: v30, viewers: people30 },
    },
    // What share of browsers saw one page and nothing else.
    bounceRate: total ? Math.round((Number(b?.once ?? 0) / total) * 100) : null,
    paths: paths.map((p) => ({ path: p.path, views: p._count.path })),
    referrers: referrers.map((r) => ({ host: r.referrer, views: r._count.referrer })),
    countries: countries.map((c) => ({ country: c.country, views: c._count.country })),
  });
}
