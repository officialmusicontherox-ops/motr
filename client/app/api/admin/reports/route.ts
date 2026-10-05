import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { periodWindow } from "@/lib/weekWindow";

/**
 * Time-bucketed statistics for the dashboard.
 *
 * Bucketing happens in Postgres via date_trunc rather than by pulling rows
 * and grouping in JS — the row counts only go one way, and a report that
 * gets slower every week isn't one anyone keeps opening.
 */

const PERIODS = {
  daily: { unit: "day", buckets: 30, label: "Last 30 days" },
  weekly: { unit: "week", buckets: 12, label: "Last 12 weeks" },
  monthly: { unit: "month", buckets: 12, label: "Last 12 months" },
  yearly: { unit: "year", buckets: 5, label: "Last 5 years" },
} as const;

type PeriodKey = keyof typeof PERIODS;

type Row = { bucket: Date; n: bigint };

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = (req.nextUrl.searchParams.get("period") ?? "daily") as PeriodKey;
  const period = PERIODS[key] ?? PERIODS.daily;
  const unit = period.unit;

  // The window start, so buckets with no activity still appear as zero rather
  // than silently vanishing from the series.
  const since = new Date();
  if (unit === "day") since.setDate(since.getDate() - (period.buckets - 1));
  if (unit === "week") since.setDate(since.getDate() - 7 * (period.buckets - 1));
  if (unit === "month") since.setMonth(since.getMonth() - (period.buckets - 1));
  if (unit === "year") since.setFullYear(since.getFullYear() - (period.buckets - 1));
  since.setHours(0, 0, 0, 0);

  const trunc = Prisma.raw(`'${unit}'`);

  const [fans, activeFans, swipes, rightSwipes, listens, tracks, submissions, revenue] =
    await Promise.all([
      prisma.$queryRaw<Row[]>`
        SELECT date_trunc(${trunc}, "createdAt") AS bucket, COUNT(*)::bigint AS n
        FROM "Fan" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      // Listeners who actually swiped, bucketed by when they joined. A
      // share link creates a listener on click, so the raw signup count
      // includes bounces and link previews that never heard anything.
      prisma.$queryRaw<Row[]>`
        SELECT date_trunc(${trunc}, f."createdAt") AS bucket, COUNT(*)::bigint AS n
        FROM "Fan" f
        WHERE f."createdAt" >= ${since}
          AND EXISTS (SELECT 1 FROM "FanSwipe" s WHERE s."fanId" = f."id")
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Row[]>`
        SELECT date_trunc(${trunc}, "createdAt") AS bucket, COUNT(*)::bigint AS n
        FROM "FanSwipe" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Row[]>`
        SELECT date_trunc(${trunc}, "createdAt") AS bucket, COUNT(*)::bigint AS n
        FROM "FanSwipe" WHERE "createdAt" >= ${since} AND "direction" = 'RIGHT'
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Array<{ bucket: Date; avg: number | null }>>`
        SELECT date_trunc(${trunc}, "createdAt") AS bucket, AVG("listenMs")::float AS avg
        FROM "FanSwipe" WHERE "createdAt" >= ${since} AND "listenMs" IS NOT NULL
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Row[]>`
        SELECT date_trunc(${trunc}, "createdAt") AS bucket, COUNT(*)::bigint AS n
        FROM "Track" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Row[]>`
        SELECT date_trunc(${trunc}, "createdAt") AS bucket, COUNT(*)::bigint AS n
        FROM "Track" WHERE "createdAt" >= ${since} AND "artistId" IS NOT NULL
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Array<{ bucket: Date; n: bigint; cents: bigint | null }>>`
        SELECT date_trunc(${trunc}, "createdAt") AS bucket, COUNT(*)::bigint AS n,
               SUM("amountCents")::bigint AS cents
        FROM "Payment" WHERE "createdAt" >= ${since} AND "status" = 'PAID'
        GROUP BY 1 ORDER BY 1`,
    ]);

  const at = <T extends { bucket: Date }>(rows: T[], iso: string): T | undefined =>
    rows.find((r) => new Date(r.bucket).toISOString().slice(0, 10) === iso);

  // Every bucket in the window, present or not.
  const labels: string[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < period.buckets; i++) {
    labels.push(new Date(cursor).toISOString().slice(0, 10));
    if (unit === "day") cursor.setDate(cursor.getDate() + 1);
    if (unit === "week") cursor.setDate(cursor.getDate() + 7);
    if (unit === "month") cursor.setMonth(cursor.getMonth() + 1);
    if (unit === "year") cursor.setFullYear(cursor.getFullYear() + 1);
  }

  const series = labels.map((iso) => {
    const total = Number(at(swipes, iso)?.n ?? 0);
    const right = Number(at(rightSwipes, iso)?.n ?? 0);
    const pay = at(revenue, iso);
    return {
      bucket: iso,
      newFans: Number(at(fans, iso)?.n ?? 0),
      activeFans: Number(at(activeFans, iso)?.n ?? 0),
      swipes: total,
      rightSwipes: right,
      // Null rather than zero when nothing happened: a bucket with no swipes
      // has no approval rate, and plotting it as 0% would invent a bad day.
      approvalRate: total > 0 ? right / total : null,
      avgListenMs: Math.round(at(listens, iso)?.avg ?? 0) || null,
      tracksAdded: Number(at(tracks, iso)?.n ?? 0),
      submissions: Number(at(submissions, iso)?.n ?? 0),
      payments: Number(pay?.n ?? 0),
      revenueCents: Number(pay?.cents ?? 0),
    };
  });

  /**
   * The figures above the chart are for the period the tab names, not for the
   * whole series behind it.
   *
   * "Weekly" used to total twelve weeks, so the dashboard reported 2,221
   * swipes under a heading that said Weekly. The chart still shows the run of
   * periods, because that is what a chart is for; the tiles answer "how is
   * this week going".
   */
  const current = periodWindow(unit, new Date());
  const inWindow = { gte: current.start, lt: current.end };

  const [nowFans, nowActive, nowSwipes, nowRight, nowListen, nowTracks, nowSubs, nowRevenue] =
    await Promise.all([
      prisma.fan.count({ where: { createdAt: inWindow } }),
      prisma.fan.count({
        where: { createdAt: inWindow, swipes: { some: {} } },
      }),
      prisma.fanSwipe.count({ where: { createdAt: inWindow } }),
      prisma.fanSwipe.count({ where: { createdAt: inWindow, direction: "RIGHT" } }),
      prisma.fanSwipe.aggregate({
        where: { createdAt: inWindow, listenMs: { not: null } },
        _avg: { listenMs: true },
      }),
      prisma.track.count({ where: { createdAt: inWindow } }),
      prisma.track.count({ where: { createdAt: inWindow, artistId: { not: null } } }),
      prisma.payment.aggregate({
        where: { createdAt: inWindow, status: "PAID" },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
    ]);

  return NextResponse.json({
    period: key,
    label: period.label,
    since: since.toISOString(),
    series,
    // What the tiles show, and what to call it.
    periodLabel: current.label,
    totals: {
      newFans: nowFans,
      activeFans: nowActive,
      swipes: nowSwipes,
      rightSwipes: nowRight,
      approvalRate: nowSwipes > 0 ? nowRight / nowSwipes : null,
      avgListenMs: nowListen._avg.listenMs !== null ? Math.round(nowListen._avg.listenMs) : null,
      tracksAdded: nowTracks,
      submissions: nowSubs,
      payments: nowRevenue._count._all,
      revenueCents: nowRevenue._sum.amountCents ?? 0,
    },
    generatedAt: new Date().toISOString(),
  });
}
