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

  // Every count in one pass. Prisma's `distinct` is applied in the client, so
  // counting unique visitors that way means loading one row per view into
  // memory; harmless at a few dozen, wasteful at a few hundred thousand, and
  // this is a page somebody opens to look at exactly that number growing.
  const [tot] = await prisma.$queryRaw<
    {
      views: bigint; viewers: bigint; from_share: bigint; landed: bigint;
      v1: bigint; v7: bigint; v30: bigint;
      p1: bigint; p7: bigint; p30: bigint; first_at: Date | null;
    }[]
  >`
    SELECT COUNT(*)::bigint AS views,
           COUNT(DISTINCT "visitorId")::bigint AS viewers,
           COUNT(*) FILTER (WHERE "fromShare")::bigint AS from_share,
           COUNT(DISTINCT "visitorId") FILTER (WHERE "path" = '/')::bigint AS landed,
           COUNT(*) FILTER (WHERE "createdAt" >= ${d1})::bigint AS v1,
           COUNT(*) FILTER (WHERE "createdAt" >= ${d7})::bigint AS v7,
           COUNT(*) FILTER (WHERE "createdAt" >= ${d30})::bigint AS v30,
           COUNT(DISTINCT "visitorId") FILTER (WHERE "createdAt" >= ${d1})::bigint AS p1,
           COUNT(DISTINCT "visitorId") FILTER (WHERE "createdAt" >= ${d7})::bigint AS p7,
           COUNT(DISTINCT "visitorId") FILTER (WHERE "createdAt" >= ${d30})::bigint AS p30,
           MIN("createdAt") AS first_at
    FROM "Visit"
  `;
  const n = (v: bigint | null) => Number(v ?? 0);

  const [started, paths, referrers, countries] =
    await Promise.all([
      tot?.first_at
        ? prisma.fan.count({ where: { createdAt: { gte: tot.first_at } } })
        : Promise.resolve(0),

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

    ]);

  const landed = n(tot?.landed ?? null);

  return NextResponse.json({
    totals: { views: n(tot?.views ?? null), viewers: n(tot?.viewers ?? null), fromShare: n(tot?.from_share ?? null) },
    windows: {
      day: { views: n(tot?.v1 ?? null), viewers: n(tot?.p1 ?? null) },
      week: { views: n(tot?.v7 ?? null), viewers: n(tot?.p7 ?? null) },
      month: { views: n(tot?.v30 ?? null), viewers: n(tot?.p30 ?? null) },
    },
    funnel: { landed, started, rate: landed ? Math.round((started / landed) * 100) : null },
    paths: paths.map((p) => ({ path: p.path, views: p._count.path })),
    referrers: referrers.map((r) => ({ host: r.referrer, views: r._count.referrer })),
    countries: countries.map((c) => ({ country: c.country, views: c._count.country })),
  });
}
