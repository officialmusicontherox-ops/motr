import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { CHART_TZ } from "@/lib/weekWindow";

/**
 * Who is actually sending listeners, and from where.
 *
 * A share link does not record which track it was opened from, so the
 * attribution is the first track a new listener swiped. That is the song
 * they landed on, which is the song whose link they followed. It is a
 * reading rather than a measurement, but it matched the one case checked by
 * hand exactly: 43 of 49 new listeners over two days started on one track,
 * and that track's share link had four times the opens of any other.
 */

type Row = {
  trackId: string;
  title: string;
  artist: string | null;
  artistEmail: string | null;
  arrived: number;
  saves: number;
  swipes: number;
  shareOpens: number;
};

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 7)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [arrivals, referrers, totals] = await Promise.all([
    // The first track each listener who arrived in the window swiped, with
    // that track's activity over the same window beside it.
    prisma.$queryRawUnsafe<
      {
        trackId: string;
        title: string;
        artist: string | null;
        artistEmail: string | null;
        arrived: bigint;
        saves: bigint;
        swipes: bigint;
        shareOpens: number;
      }[]
    >(
      `
      WITH firsts AS (
        SELECT DISTINCT ON (s."fanId") s."fanId", s."trackId"
        FROM "FanSwipe" s
        JOIN "Fan" f ON f.id = s."fanId"
        WHERE f."createdAt" >= $1
        ORDER BY s."fanId", s."createdAt" ASC
      ),
      windowed AS (
        SELECT s."trackId",
               count(*) AS swipes,
               count(*) FILTER (WHERE s.direction = 'RIGHT') AS saves
        FROM "FanSwipe" s WHERE s."createdAt" >= $1 GROUP BY 1
      )
      SELECT t.id AS "trackId", t.title, a.name AS artist, a.email AS "artistEmail",
             count(f."fanId") AS arrived,
             coalesce(w.saves, 0) AS saves,
             coalesce(w.swipes, 0) AS swipes,
             t."shareOpens" AS "shareOpens"
      FROM firsts f
      JOIN "Track" t ON t.id = f."trackId"
      LEFT JOIN "Artist" a ON a.id = t."artistId"
      LEFT JOIN windowed w ON w."trackId" = t.id
      GROUP BY t.id, t.title, a.name, a.email, w.saves, w.swipes, t."shareOpens"
      ORDER BY count(f."fanId") DESC, t."shareOpens" DESC
      LIMIT 25
      `,
      since
    ),

    prisma.visit.groupBy({
      by: ["referrer"],
      where: {
        createdAt: { gte: since },
        referrer: { not: null, notIn: ["accounts.google.com", "accounts.youtube.com"] },
      },
      _count: { referrer: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 12,
    }),

    prisma.visit.aggregate({
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const [newFans, shareVisits] = await Promise.all([
    prisma.fan.count({ where: { createdAt: { gte: since } } }),
    prisma.visit.count({ where: { createdAt: { gte: since }, fromShare: true } }),
  ]);

  const rows: Row[] = arrivals.map((r) => ({
    trackId: r.trackId,
    title: r.title,
    artist: r.artist,
    artistEmail: r.artistEmail,
    arrived: Number(r.arrived),
    saves: Number(r.saves),
    swipes: Number(r.swipes),
    shareOpens: r.shareOpens,
  }));

  return NextResponse.json({
    days,
    timezone: CHART_TZ,
    newListeners: newFans,
    shareVisits,
    views: totals._count._all,
    rows,
    referrers: referrers.map((r) => ({ host: r.referrer as string, views: r._count.referrer })),
  });
}
