import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * The weekly chart winner: whoever's music was saved most in a given week.
 *
 * The prize is a write-up on Music On The Rox, which is worth something an
 * algorithm can't fake — a real piece of editorial on a real site.
 *
 * Winners are recorded rather than recomputed. A chart is a moving window,
 * so running the same query a month later gives a different answer; the week
 * someone actually won has to be written down while it's still true.
 */

/** Nothing before this counts. The contest starts in October. */
export const CONTEST_START = new Date(Date.UTC(2026, 9, 1)); // 1 October 2026

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStartOf(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // getUTCDay is 0 for Sunday, so Sunday belongs to the week that began six
  // days earlier rather than starting a new one.
  const back = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - back);
  return copy;
}

export type WeekResult = {
  weekStart: string;
  weekEnd: string;
  artistId: string | null;
  artistName: string;
  saves: number;
  tracks: number;
};

/**
 * Who topped a given week, computed from the swipes in it.
 *
 * Submissions only. The seeded catalogue exists to keep the feed full and
 * can't win a prize aimed at the artists who chose to be here.
 */
export async function winnerForWeek(weekStart: Date): Promise<WeekResult | null> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const rows = await prisma.$queryRaw<
    { artistId: string; name: string; saves: bigint; tracks: bigint }[]
  >(Prisma.sql`
    SELECT t."artistId" AS "artistId",
      MIN(a."name") AS name,
      COUNT(*) FILTER (WHERE s."direction" = 'RIGHT')::bigint AS saves,
      COUNT(DISTINCT t."id")::bigint AS tracks
    FROM "Track" t
    JOIN "Artist" a ON a."id" = t."artistId"
    JOIN "FanSwipe" s ON s."trackId" = t."id"
    WHERE t."artistId" IS NOT NULL
      AND t."status" <> 'REJECTED'
      AND s."createdAt" >= ${weekStart}
      AND s."createdAt" < ${weekEnd}
    GROUP BY t."artistId"
    HAVING COUNT(*) FILTER (WHERE s."direction" = 'RIGHT') > 0
    ORDER BY saves DESC, tracks ASC
    LIMIT 1
  `);

  const top = rows[0];
  if (!top) return null;

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    artistId: top.artistId,
    artistName: top.name,
    saves: Number(top.saves),
    tracks: Number(top.tracks),
  };
}

/**
 * Every week from the contest start to the last completed one, with whoever
 * has already been recorded as the winner.
 *
 * The current week is deliberately excluded: a winner isn't a winner until
 * the week is over, and locking one in early would reward whoever happened
 * to be ahead on a Tuesday.
 */
export async function chartWinnerBoard() {
  const recorded = await prisma.chartWinner.findMany({ orderBy: { weekStart: "desc" } });
  const byWeek = new Map(recorded.map((w) => [w.weekStart.toISOString(), w]));

  const thisWeek = weekStartOf(new Date());
  const weeks: {
    weekStart: string;
    weekEnd: string;
    recorded: (typeof recorded)[number] | null;
    provisional: WeekResult | null;
  }[] = [];

  for (let w = new Date(thisWeek); w >= CONTEST_START; w.setUTCDate(w.getUTCDate() - 7)) {
    const start = new Date(w);
    if (start.getTime() === thisWeek.getTime()) continue; // still running
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const key = start.toISOString();
    const already = byWeek.get(key) ?? null;
    weeks.push({
      weekStart: key,
      weekEnd: end.toISOString(),
      recorded: already,
      // Only computed for weeks nobody has locked in yet, so a recorded
      // winner can never be silently contradicted by a later recount.
      provisional: already ? null : await winnerForWeek(start),
    });
  }

  return weeks;
}

/** Writes a week's winner down, so a later recount can't change it. */
export async function lockWeek(weekStart: Date) {
  const result = await winnerForWeek(weekStart);
  if (!result) return null;

  return prisma.chartWinner.upsert({
    where: { weekStart },
    create: {
      weekStart,
      artistId: result.artistId,
      artistName: result.artistName,
      saves: result.saves,
    },
    update: {},
  });
}
