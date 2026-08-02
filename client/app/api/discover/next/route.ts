import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Next track for a fan to swipe on.
 *
 * Two guarantees:
 *  - Never repeats. Anything the fan has already swiped is excluded, and a
 *    unique constraint on (fanId, trackId) backs that up server-side.
 *  - Random order every time, so two fans don't walk the same sequence and a
 *    returning fan doesn't replay the feed in the order tracks were added.
 *
 * Done in SQL because Prisma has no random ordering, and pulling the whole
 * unswiped set into memory to shuffle would stop scaling quickly.
 */
export async function GET(req: NextRequest) {
  const fanId = req.nextUrl.searchParams.get("fanId");
  if (!fanId) {
    return NextResponse.json({ error: "fanId query param is required" }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT t."id"
    FROM "Track" t
    WHERE t."status" = 'DISCOVERY'::"TrackStatus"
      AND NOT EXISTS (
        SELECT 1 FROM "FanSwipe" s
        WHERE s."trackId" = t."id" AND s."fanId" = ${fanId}
      )
    ORDER BY RANDOM()
    LIMIT 1
  `);

  if (rows.length === 0) return NextResponse.json({ track: null });

  // Re-read through the client so the response shape stays in sync with the
  // schema rather than being hand-maintained in raw SQL.
  const track = await prisma.track.findUnique({ where: { id: rows[0].id } });
  return NextResponse.json({ track });
}
