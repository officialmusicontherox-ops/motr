import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * How many unheard tracks this fan has left in each genre.
 *
 * Drives the genre strip: a chip for a genre with nothing left behind it is
 * a dead end, so the picker hides it rather than letting someone tap into an
 * empty feed.
 */
export async function GET(req: NextRequest) {
  const fanId = req.nextUrl.searchParams.get("fanId");
  if (!fanId) {
    return NextResponse.json({ error: "fanId query param is required" }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<Array<{ genre: string | null; n: bigint }>>(Prisma.sql`
    SELECT t."genre" AS genre, COUNT(*)::bigint AS n
    FROM "Track" t
    WHERE t."status" = 'DISCOVERY'::"TrackStatus"
      AND NOT EXISTS (
        SELECT 1 FROM "FanSwipe" s
        WHERE s."trackId" = t."id" AND s."fanId" = ${fanId}
      )
    GROUP BY t."genre"
  `);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    total += Number(r.n);
    if (r.genre) counts[r.genre] = Number(r.n);
  }

  return NextResponse.json({ counts, total });
}
