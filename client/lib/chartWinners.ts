import { prisma } from "./prisma";
import { AI_CHART_FROM, artistTotalsSql, splitsAiChart, type ChartKind } from "./scoutData";

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
 * Who topped a given week on one chart, computed from the swipes in it.
 *
 * Submissions only. The seeded catalogue exists to keep the feed full and
 * can't win a prize aimed at the artists who chose to be here.
 *
 * From AI_CHART_FROM there are two winners a week, one for Top Artists and
 * one for AI Artists. Before it there was one chart, and "ai" has no winner.
 */
export async function winnerForWeek(weekStart: Date, kind: ChartKind = "regular"): Promise<WeekResult | null> {
  const weekEnd = weekEndOf(weekStart);
  if (kind === "ai" && !splitsAiChart(weekEnd)) return null;

  // The same count as the chart, so the winner is always the artist the
  // chart shows at number one. Best two songs each from BEST_TWO_FROM.
  const rows = await prisma.$queryRaw<
    { artistId: string; name: string; saves: bigint; tracks: bigint }[]
  >(
    artistTotalsSql({
      since: weekStart,
      until: weekEnd,
      limit: 1,
      needSave: true,
      order: "winner",
      kind: splitsAiChart(weekEnd) ? kind : undefined,
    })
  );

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

type Recorded = Awaited<ReturnType<typeof prisma.chartWinner.findMany>>[number];

/** One chart's side of a week: who was recorded, or who leads if nobody was. */
export type WinnerSlot = { recorded: Recorded | null; provisional: WeekResult | null };

/**
 * Every week from the contest start to the last completed one, with whoever
 * has already been recorded on each chart.
 *
 * The current week is deliberately excluded: a winner isn't a winner until
 * the week is over, and locking one in early would reward whoever happened
 * to be ahead on a Tuesday.
 *
 * `ai` is null for weeks before AI_CHART_FROM, which had one chart.
 */
export async function chartWinnerBoard() {
  const recorded = await prisma.chartWinner.findMany({ orderBy: { weekStart: "desc" } });
  const byWeek = new Map(recorded.map((w) => [`${w.weekStart.toISOString()}|${w.kind}`, w]));

  const thisWeek = weekStartOf(new Date());
  const weeks: { weekStart: string; weekEnd: string; regular: WinnerSlot; ai: WinnerSlot | null }[] = [];

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

    // Only computed for a chart nobody has locked yet, so a recorded winner
    // can never be silently contradicted by a later recount.
    const slot = async (kind: ChartKind): Promise<WinnerSlot> => {
      const already = byWeek.get(`${key}|${kind}`) ?? null;
      return { recorded: already, provisional: already ? null : await winnerForWeek(start, kind) };
    };

    weeks.push({
      weekStart: key,
      weekEnd: end.toISOString(),
      regular: await slot("regular"),
      ai: start >= AI_CHART_FROM ? await slot("ai") : null,
    });
  }

  return weeks;
}

/**
 * Writes a week's winners down, both charts at once, so a later recount
 * can't change either. Returns what was recorded, which is nothing if
 * nobody was saved that week on either chart.
 */
export async function lockWeek(weekStart: Date) {
  const kinds: ChartKind[] = weekStart >= AI_CHART_FROM ? ["regular", "ai"] : ["regular"];
  const out = [];
  for (const kind of kinds) {
    const result = await winnerForWeek(weekStart, kind);
    if (!result) continue;
    out.push(
      await prisma.chartWinner.upsert({
        where: { weekStart_kind: { weekStart, kind } },
        create: {
          weekStart,
          kind,
          artistId: result.artistId,
          artistName: result.artistName,
          saves: result.saves,
        },
        update: {},
      })
    );
  }
  return out;
}
