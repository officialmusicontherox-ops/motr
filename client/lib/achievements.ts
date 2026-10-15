/**
 * What a listener has earned.
 *
 * Nothing here is stored. Every badge is derived from the swipes already on
 * record, which has three consequences worth keeping: it works retroactively,
 * so this ships with everyone's history already counted rather than as an
 * empty page; a threshold can be retuned by editing a line instead of
 * rewriting rows; and there is no state that can disagree with the swipes it
 * came from.
 *
 * What gets rewarded is deliberate. Saves are what the chart ranks and what
 * the A&R data is worth, so paying people for save volume would be paying
 * them to pollute it. The save rungs stop at five, which nobody would farm,
 * and everything above is listening depth, breadth and coming back, none of
 * which can be inflated in a way that costs anything.
 */

import { prisma } from "./prisma";
import { FULL_LISTEN_MS } from "./economics";

export type FanStats = {
  swipes: number;
  saves: number;
  fullListens: number;
  listenMinutes: number;
  /** Tracks they heard out and were the first person ever to save. */
  firstFinds: number;
  /** Whether they have an address on the account. */
  signedIn: number;
  /** Distinct genres they have saved from. */
  genres: number;
  /** Separate days they have swiped on. */
  days: number;
  /** Longest run of consecutive days. */
  streak: number;
  /** Most swipes in a single day. */
  bestDay: number;
  /** Tracks turned down. Passing honestly is half the job. */
  passes: number;
  /** Different artists they have kept something by. */
  artists: number;
  /** Tracks kept within a day of landing on MOTR. */
  dayOne: number;
  /** Artists they kept before that artist went on to win a week. */
  chartBacked: number;
};

/** Longest run of consecutive days in a set of YYYY-MM-DD strings. */
export function longestStreak(days: string[]): number {
  if (!days.length) return 0;
  const sorted = [...new Set(days)].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = Date.parse(sorted[i - 1] + "T00:00:00Z");
    const curr = Date.parse(sorted[i] + "T00:00:00Z");
    run = curr - prev === 86_400_000 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Every stat for one fan, or for everyone when fanId is null.
 *
 * One query either way. The all-fans form is what rarity is computed from,
 * and running the identical expressions means a badge can never be counted
 * one way for the person holding it and another way for the percentage
 * printed beside it.
 */
async function statsRows(fanId: string | null) {
  return prisma.$queryRaw<
    {
      fan_id: string;
      swipes: number;
      saves: number;
      full_listens: number;
      listen_ms: bigint;
      first_finds: number;
      genres: number;
      passes: number;
      artists: number;
      day_one: number;
      chart_backed: number;
      best_day: number;
      days: string[];
    }[]
  >`
    SELECT
      s."fanId" AS fan_id,
      COUNT(*)::int AS swipes,
      COUNT(*) FILTER (WHERE s.direction = 'RIGHT')::int AS saves,
      COUNT(*) FILTER (WHERE s.direction = 'LEFT')::int AS passes,
      COUNT(*) FILTER (WHERE s."listenMs" >= ${FULL_LISTEN_MS})::int AS full_listens,
      COALESCE(SUM(s."listenMs"), 0)::bigint AS listen_ms,
      -- First to save it, and only when they heard it out. Without the listen
      -- condition this could be farmed by right-swiping everything, which is
      -- the one thing these badges must never pay for.
      COUNT(*) FILTER (
        WHERE s.direction = 'RIGHT'
          AND s."listenMs" >= ${FULL_LISTEN_MS}
          AND NOT EXISTS (
            SELECT 1 FROM "FanSwipe" e
            WHERE e."trackId" = s."trackId"
              AND e.direction = 'RIGHT'
              AND e."createdAt" < s."createdAt"
          )
      )::int AS first_finds,
      COUNT(DISTINCT t.genre) FILTER (WHERE s.direction = 'RIGHT' AND t.genre IS NOT NULL)::int AS genres,
      COUNT(DISTINCT t."artistId") FILTER (WHERE s.direction = 'RIGHT' AND t."artistId" IS NOT NULL)::int AS artists,
      COUNT(*) FILTER (WHERE s.direction = 'RIGHT' AND s."createdAt" < t."createdAt" + INTERVAL '24 hours')::int AS day_one,
      -- Kept an artist before that artist won a week. VETTING and GRADUATED
      -- were used here first and were wrong: no track has ever held either
      -- status and the only path into them is the retired fee model. The
      -- chart is what exists, so the chart is what this reads. Empty until
      -- the first week locks, which is the point of it: it lands later and
      -- brings them back to find out.
      COUNT(DISTINCT t."artistId") FILTER (
        WHERE s.direction = 'RIGHT'
          AND EXISTS (
            SELECT 1 FROM "ChartWinner" w
            WHERE w."artistId" = t."artistId" AND w."weekStart" > s."createdAt"
          )
      )::int AS chart_backed,
      COALESCE(MAX(d.n), 0)::int AS best_day,
      COALESCE(ARRAY_AGG(DISTINCT TO_CHAR(s."createdAt", 'YYYY-MM-DD')), ARRAY[]::text[]) AS days
    FROM "FanSwipe" s
    LEFT JOIN "Track" t ON t.id = s."trackId"
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS n FROM "FanSwipe" x
      WHERE x."fanId" = s."fanId" GROUP BY DATE(x."createdAt")
      ORDER BY 1 DESC LIMIT 1
    ) d ON TRUE
    WHERE (${fanId}::text IS NULL OR s."fanId" = ${fanId})
    GROUP BY s."fanId"`;
}

function toStats(r: Awaited<ReturnType<typeof statsRows>>[number], signedIn: boolean): FanStats {
  const days = (r.days ?? []).filter(Boolean);
  return {
    swipes: r.swipes,
    saves: r.saves,
    fullListens: r.full_listens,
    listenMinutes: Math.floor(Number(r.listen_ms) / 60_000),
    firstFinds: r.first_finds,
    genres: r.genres,
    passes: r.passes,
    artists: r.artists,
    dayOne: r.day_one,
    chartBacked: r.chart_backed,
    bestDay: r.best_day,
    days: days.length,
    streak: longestStreak(days),
    signedIn: signedIn ? 1 : 0,
  };
}

const EMPTY: FanStats = {
  swipes: 0, saves: 0, fullListens: 0, listenMinutes: 0, firstFinds: 0, genres: 0,
  passes: 0, artists: 0, dayOne: 0, chartBacked: 0, bestDay: 0, days: 0, streak: 0, signedIn: 0,
};

export async function fanStats(fanId: string): Promise<FanStats> {
  const [fan, rows] = await Promise.all([
    prisma.fan.findUnique({ where: { id: fanId }, select: { email: true, googleId: true } }),
    statsRows(fanId),
  ]);
  const signedIn = Boolean(fan?.email || fan?.googleId);
  return rows[0] ? toStats(rows[0], signedIn) : { ...EMPTY, signedIn: signedIn ? 1 : 0 };
}

/**
 * How many listeners hold each badge, as a fraction.
 *
 * Cached briefly: it moves slowly, every visitor asks the same question, and
 * the answer costs a pass over every swipe on record.
 */
let rarityCache: { at: number; value: Record<string, number> } | null = null;
const RARITY_TTL_MS = 5 * 60_000;

export async function badgeRarity(): Promise<Record<string, number>> {
  if (rarityCache && Date.now() - rarityCache.at < RARITY_TTL_MS) return rarityCache.value;

  const rows = await statsRows(null);
  const all = rows.map((r) => toStats(r, false));
  const out: Record<string, number> = {};
  for (const b of BADGES) {
    if (b.stat === "signedIn") continue; // not derived from swipes
    const held = all.filter((s) => Number(s[b.stat] ?? 0) >= b.need).length;
    out[b.id] = all.length ? held / all.length : 0;
  }
  rarityCache = { at: Date.now(), value: out };
  return out;
}

export type Badge = {
  id: string;
  name: string;
  /** What earns it, written as the thing they did. */
  note: string;
  /** Which stat it reads, and what it takes. */
  stat: keyof FanStats;
  need: number;
};

/**
 * Calibrated against what listeners actually do, not what sounds impressive.
 * The heaviest listener on record has eighteen minutes and sixty-four saves,
 * and the median is seven swipes, so the first rungs are deliberately small:
 * a ladder nobody can climb is the same as no ladder.
 */
export const BADGES: Badge[] = [
  // The first-minute win. Everything else depends on this one landing early.
  { id: "first-save", name: "First Keep", note: "Saved your first track", stat: "saves", need: 1 },
  { id: "five-saves", name: "Picking Favourites", note: "Saved five tracks", stat: "saves", need: 5 },
  // The save ladder stops here on purpose. Saves are what the chart ranks and
  // what the A&R data is worth, and a badge for fifty of them would be paying
  // people to swipe right without listening.

  { id: "heard-out", name: "Heard It Out", note: "Listened to one clip all the way through", stat: "fullListens", need: 1 },
  { id: "full-five", name: "Patient Ear", note: "Five full listens", stat: "fullListens", need: 5 },
  { id: "full-fifteen", name: "Nothing Skipped", note: "Fifteen full listens", stat: "fullListens", need: 15 },

  // Earned only on a full listen, so being early still means having heard it.
  { id: "first-find", name: "Found It First", note: "First person to hear a track out and keep it", stat: "firstFinds", need: 1 },
  { id: "find-five", name: "Early Ear", note: "First to find five tracks", stat: "firstFinds", need: 5 },
  { id: "find-fifteen", name: "Tastemaker", note: "First to find fifteen tracks", stat: "firstFinds", need: 15 },

  { id: "genres-three", name: "Open Minded", note: "Saved from three genres", stat: "genres", need: 3 },
  { id: "genres-six", name: "Wide Ears", note: "Saved from six genres", stat: "genres", need: 6 },
  { id: "genres-ten", name: "No Lane", note: "Saved from ten genres", stat: "genres", need: 10 },

  { id: "minutes-five", name: "Five Minutes In", note: "Five minutes of listening", stat: "listenMinutes", need: 5 },
  { id: "minutes-fifteen", name: "Quarter Hour", note: "Fifteen minutes of listening", stat: "listenMinutes", need: 15 },

  // The only rungs that ask for a second visit, which is the real leak: four
  // listeners in five swipe on one day and never come back. Nine people have
  // ever managed two days running and one has managed three, so these are set
  // against what actually happens rather than against what sounds impressive.
  { id: "streak-two", name: "Came Back", note: "Two days running", stat: "streak", need: 2 },
  { id: "streak-three", name: "Three in a Row", note: "Three days running", stat: "streak", need: 3 },
  { id: "streak-five", name: "Five in a Row", note: "Five days running", stat: "streak", need: 5 },

  { id: "artists-five", name: "Five Names", note: "Kept something by five different artists", stat: "artists", need: 5 },
  { id: "artists-fifteen", name: "Fifteen Names", note: "Kept something by fifteen different artists", stat: "artists", need: 15 },
  { id: "artists-thirty", name: "Thirty Names", note: "Kept something by thirty different artists", stat: "artists", need: 30 },

  { id: "day-one", name: "Day One", note: "Kept a track within a day of it landing", stat: "dayOne", need: 1 },
  { id: "day-one-five", name: "On the Door", note: "Five tracks kept on their first day", stat: "dayOne", need: 5 },
  { id: "day-one-twelve", name: "Always Early", note: "Twelve tracks kept on their first day", stat: "dayOne", need: 12 },

  // Passing honestly is half of what makes the chart mean anything, and it is
  // the only half nothing else here rewards.
  { id: "passes-25", name: "Fair Hearing", note: "Turned down twenty-five tracks", stat: "passes", need: 25 },
  { id: "passes-100", name: "Hard to Please", note: "Turned down a hundred tracks", stat: "passes", need: 100 },

  { id: "day-25", name: "Good Session", note: "Twenty-five swipes in one day", stat: "bestDay", need: 25 },
  { id: "day-50", name: "Long Session", note: "Fifty swipes in one day", stat: "bestDay", need: 50 },
  { id: "day-100", name: "Marathon", note: "A hundred swipes in one day", stat: "bestDay", need: 100 },

  // The one that can only arrive later. Nothing else here depends on what the
  // rest of the room does afterwards.
  { id: "called-it", name: "Called It", note: "Kept an artist before they won the week", stat: "chartBacked", need: 1 },
  { id: "called-it-three", name: "Good Ear", note: "Three artists kept before they won a week", stat: "chartBacked", need: 3 },
  { id: "called-it-ten", name: "Ahead of the Room", note: "Ten artists kept before they won a week", stat: "chartBacked", need: 10 },

  { id: "signed-in", name: "Keeping It", note: "Added an email so none of this is lost", stat: "signedIn", need: 1 },
];

export type EarnedBadge = Badge & { have: number; earned: boolean };

export function evaluate(stats: FanStats): EarnedBadge[] {
  return BADGES.map((b) => {
    const have = Number(stats[b.stat] ?? 0);
    return { ...b, have, earned: have >= b.need };
  });
}
