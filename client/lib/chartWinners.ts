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
import { CHART_START, weekOf } from "./weekWindow";
export { CHART_START };

/**
 * The start of the chart week containing `d`.
 *
 * The same week the site, the charts and the emails use: Sunday to Saturday
 * in Central time. This used to compute Monday to Monday in UTC, a different
 * seven days about eighteen hours out of step, which meant the winner was
 * counted over a window nobody had been shown. It also left the week that
 * had just closed unlockable until the Monday after it.
 */
export function weekStartOf(d: Date): Date {
  return weekOf(d).start;
}

/** The instant a chart week ends, exclusive. */
function weekEndOf(start: Date): Date {
  // Read back through weekOf rather than adding seven days of milliseconds,
  // so the week containing a daylight-saving change is still seven days.
  return weekOf(new Date(start.getTime() + 36 * 60 * 60 * 1000)).end;
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
  const weekEnd = weekEndOf(weekStart);

  const rows = await prisma.$queryRaw<
    { artistId: string; name: string; saves: bigint; tracks: bigint }[]
  >(Prisma.sql`
    SELECT MIN(t."artistId") AS "artistId",
      COALESCE(t."appleArtistName", t."artistName") AS name,
      COUNT(*) FILTER (WHERE s."direction" = 'RIGHT')::bigint AS saves,
      COALESCE(SUM(s."weight") FILTER (WHERE s."direction" = 'RIGHT'), 0)::bigint AS score,
      COUNT(DISTINCT t."id")::bigint AS tracks
    FROM "Track" t
    JOIN "FanSwipe" s ON s."trackId" = t."id"
    WHERE t."artistId" IS NOT NULL
      AND t."status" <> 'REJECTED'
      AND s."createdAt" >= ${weekStart}
      AND s."createdAt" < ${weekEnd}
    -- By Apple's artist id, matching the chart exactly.
    GROUP BY COALESCE(t."appleArtistId", 'name:' || t."artistName"),
             COALESCE(t."appleArtistName", t."artistName")
    HAVING COUNT(*) FILTER (WHERE s."direction" = 'RIGHT') > 0
    -- Weighted, the same as the chart. The winner of the week has to be the
    -- artist the chart shows at number one, or the two contradict each other
    -- in public on the same morning.
    ORDER BY score DESC, tracks ASC
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

  // Walked back a week at a time through weekOf, so each step lands on a
  // real chart week rather than drifting across a clock change.
  for (
    let start = new Date(thisWeek);
    start >= CHART_START;
    start = weekOf(new Date(start.getTime() - 24 * 60 * 60 * 1000)).start
  ) {
    if (start.getTime() === thisWeek.getTime()) continue; // still running
    const end = weekEndOf(start);

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
