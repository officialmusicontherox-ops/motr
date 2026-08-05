import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GENRES } from "@/lib/genres";

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

  // A shared link puts that track first. An artist sending fans to MOTR
  // otherwise has roughly a 6% chance of any one of them reaching the song —
  // nine swipes into a feed of 153 — which makes sharing pointless.
  // Served once: after they swipe it, the feed carries on as normal.
  const startWith = req.nextUrl.searchParams.get("track");
  if (startWith) {
    const asked = await prisma.track.findFirst({
      where: {
        id: startWith,
        status: "DISCOVERY",
        NOT: { fanSwipes: { some: { fanId } } },
      },
    });
    if (asked) return NextResponse.json({ track: asked, fromShare: true });
  }

  // Optional mood filter. Anything not in the fixed list is ignored rather
  // than rejected, so a stale bookmark degrades to the full feed.
  const requested = req.nextUrl.searchParams.get("genre");
  const genre = requested && (GENRES as readonly string[]).includes(requested) ? requested : null;

  const genreClause = genre ? Prisma.sql`AND t."genre" = ${genre}` : Prisma.empty;

  /**
   * Every sixth card is a recent submission.
   *
   * Counted off the listener's own swipes rather than rolled at random, so
   * it lands as a rhythm they can feel — a steady trickle of new music
   * between the catalogue — instead of clumping or vanishing by chance.
   *
   * Pure random was fair but slow: across 153 tracks a submission collected
   * about 0.29 votes a day, most of a year to reach 75. It also buried the
   * newest work under a catalogue that mostly exists to make the feed feel
   * full.
   *
   * Falls straight through to the normal pick when there's nothing recent
   * left for this listener, so nobody sees a repeat or runs out early.
   */
  const EVERY = 6;
  const swipesSoFar = await prisma.fanSwipe.count({ where: { fanId } });
  const dueANewOne = swipesSoFar > 0 && swipesSoFar % EVERY === 0;

  if (dueANewOne && !genre) {
    const recent = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT t."id"
      FROM "Track" t
      WHERE t."status" = 'DISCOVERY'::"TrackStatus"
        AND t."artistId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "FanSwipe" s
          WHERE s."trackId" = t."id" AND s."fanId" = ${fanId}
        )
      ORDER BY t."createdAt" DESC
      LIMIT 5
    `);
    if (recent.length > 0) {
      // Spread across the newest few, so one track doesn't take every slot.
      const pick = recent[Math.floor(Math.random() * recent.length)];
      const track = await prisma.track.findUnique({ where: { id: pick.id } });
      if (track) return NextResponse.json({ track, fresh: true });
    }
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT t."id"
    FROM "Track" t
    WHERE t."status" = 'DISCOVERY'::"TrackStatus"
      ${genreClause}
      AND NOT EXISTS (
        SELECT 1 FROM "FanSwipe" s
        WHERE s."trackId" = t."id" AND s."fanId" = ${fanId}
      )
    ORDER BY RANDOM()
    LIMIT 1
  `);

  // Out of tracks in this genre, but not out of tracks overall — tell the
  // client so it can offer a way back rather than a dead end.
  if (rows.length === 0 && genre) {
    const anyLeft = await prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n
      FROM "Track" t
      WHERE t."status" = 'DISCOVERY'::"TrackStatus"
        AND NOT EXISTS (
          SELECT 1 FROM "FanSwipe" s
          WHERE s."trackId" = t."id" AND s."fanId" = ${fanId}
        )
    `);
    return NextResponse.json({
      track: null,
      genreExhausted: true,
      othersAvailable: Number(anyLeft[0]?.n ?? 0),
    });
  }

  if (rows.length === 0) return NextResponse.json({ track: null });

  // Re-read through the client so the response shape stays in sync with the
  // schema rather than being hand-maintained in raw SQL.
  const track = await prisma.track.findUnique({ where: { id: rows[0].id } });
  return NextResponse.json({ track });
}
