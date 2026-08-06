import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

/**
 * Every track anyone has saved, ranked by how many times.
 *
 * A save is a right-swipe and a decline is a left one — the two directions of
 * the same action, so they're the only two numbers here.
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
  saves: number;
  declined: number;
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
      COUNT(*) FILTER (WHERE s."direction" = 'RIGHT')::int AS saves,
      COUNT(*) FILTER (WHERE s."direction" = 'LEFT')::int AS declined,
      MAX(s."createdAt") FILTER (WHERE s."direction" = 'RIGHT') AS "lastSavedAt"
    FROM "FanSwipe" s
    JOIN "Track" t ON t."id" = s."trackId"
    GROUP BY t."id"
    HAVING COUNT(*) FILTER (WHERE s."direction" = 'RIGHT') > 0
    ORDER BY saves DESC, t."title" ASC`;

  return NextResponse.json({
    tracks: rows,
    totalSaves: rows.reduce((n, r) => n + r.saves, 0),
  });
}
