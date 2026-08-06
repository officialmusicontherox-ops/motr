import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

/**
 * Every track anyone has saved, ranked by how many times.
 *
 * This is the A&R data the platform exists to produce, so it shouldn't be a
 * number you can only see in aggregate. A save is a right-swipe, so `saves`
 * is the subset of `votes` — every swipe on the track, both directions — that
 * went right. Both are returned because 8 saves out of 10 swipes and 8 out of
 * 200 are opposite results and the count alone can't tell them apart.
 *
 * Counted in Postgres rather than by pulling swipes and grouping in JS — the
 * swipe table is the fastest-growing one there is.
 */

type Row = {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  genre: string | null;
  status: string;
  saves: number;
  votes: number;
  lastSavedAt: Date | null;
};

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      t."id",
      t."title",
      t."artistName",
      t."artworkUrl",
      t."genre",
      t."status"::text AS status,
      COUNT(*) FILTER (WHERE s."direction" = 'RIGHT')::int AS saves,
      COUNT(*)::int AS votes,
      MAX(s."createdAt") FILTER (WHERE s."direction" = 'RIGHT') AS "lastSavedAt"
    FROM "FanSwipe" s
    JOIN "Track" t ON t."id" = s."trackId"
    GROUP BY t."id"
    HAVING COUNT(*) FILTER (WHERE s."direction" = 'RIGHT') > 0
    ORDER BY saves DESC, votes DESC, t."title" ASC`;

  return NextResponse.json({
    tracks: rows,
    totalSaves: rows.reduce((n, r) => n + r.saves, 0),
  });
}
