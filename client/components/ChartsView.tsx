"use client";

import { useCallback, useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import { useRefreshOnReturn } from "@/lib/useRefreshOnReturn";

type ChartArtist = { rank: number; id: string; name: string };

type Charts = {
  /** Top Artists: every song not marked as AI vocals. */
  artists: ChartArtist[];
  /** AI Artists: songs with AI vocals. Optional so an older payload still renders. */
  aiArtists?: ChartArtist[];
  /** False for a week before 22 November 2026, which had one chart. */
  aiChart?: boolean;
  /** Battle Wins, by artist. Optional so an older cached payload still renders. */
  battles?: ChartArtist[];
  since: string;
  days: number;
  /** "October 4 - October 10", or "Last 30 days". */
  label: string;
  range: Range;
  /** The Sunday of the week being shown, as YYYY-MM-DD. */
  week?: string;
  /** Weeks that can be looked back at, newest first. */
  weeks?: { key: string; label: string; shortLabel: string }[];
};

type Range = "week" | "month";
type Board = "artists" | "ai" | "battles";

/** Often enough to feel live, and only while someone is watching. */
const POLL_MS = 60_000;

/**
 * The public charts.
 *
 * Ranks only. The counts behind them are small at this stage, and a number one
 * with three saves printed beside it invites the wrong conclusion about the
 * platform, where the rank on its own is the part an artist screenshots.
 *
 * Kept current three ways: a poll while the page is open, a refetch when the
 * app comes back to the foreground, and an uncached endpoint so neither can be
 * handed a stale answer.
 */
export default function ChartsView() {
  const [data, setData] = useState<Charts | null>(null);
  const [range, setRange] = useState<Range>("week");
  /** Which week is being looked at. Empty means the one in progress. */
  const [week, setWeek] = useState<string>("");
  const [board, setBoard] = useState<Board>("artists");
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/charts?range=${range}${range === "week" && week ? `&week=${week}` : ""}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error();
      setData(await res.json());
      setFailed(false);
    } catch {
      // Only an error if there's nothing on screen yet. A failed refresh
      // behind a chart that's already showing should leave it alone.
      setData((current) => {
        if (!current) setFailed(true);
        return current;
      });
    }
  }, [range, week]);

  /**
   * Polls only while the page is actually being looked at.
   *
   * The interval used to run whatever the tab was doing, so one chart left
   * open in a background tab queried the database every minute for as long as
   * the tab existed. Neon suspends after five minutes idle and bills for the
   * time it is awake, which made a forgotten tab a standing charge.
   *
   * Nothing is lost by stopping: useRefreshOnReturn below already refetches
   * when the app comes back after a real absence, which is the moment the
   * numbers matter again.
   */
  useEffect(() => {
    load();
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(load, POLL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const live = range === "month" || !week || week === data?.week;
    const onVisibility = () =>
      document.visibilityState === "visible" && live ? start() : stop();

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, range, week, data?.week]);

  useRefreshOnReturn(load);

  return (
    <MotrShell>
      <div className="w-full max-w-md">
        <header className="mb-4 text-center">
          <h1 className="font-display text-2xl uppercase tracking-wide">Charts</h1>
          <p className="text-muted mt-1.5 text-sm leading-relaxed">
            The artists listeners backed hardest, heard with no artist name attached.
          </p>
        </header>

        {/* Which week. Only on the weekly view, since "last 30 days" has no
            weeks to pick between. Shown even while there is one, so it is
            visibly there and fills up as the weeks pass. */}
        {range === "week" && (data?.weeks?.length ?? 0) > 0 && (
          <div className="mb-3 flex justify-center">
            <label className="sr-only" htmlFor="chart-week">
              Which week
            </label>
            <select
              id="chart-week"
              value={week || data?.week || ""}
              onChange={(e) => {
                setWeek(e.target.value);
                setData(null);
              }}
              className="border-edge bg-surface text-ink focus:border-gold rounded-full border px-4 py-1.5 text-sm font-semibold outline-none transition"
            >
              {(data?.weeks ?? []).map((w, i) => (
                <option key={w.key} value={w.key}>
                  {i === 0 ? `This week (${w.label})` : w.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3 flex justify-center gap-2">
          {(
            [
              ["week", "This week"],
              ["month", "This month"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setRange(key);
                if (key === "month") setWeek("");
              }}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                range === key
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-edge text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* One board at a time. Two top tens stacked is a scroll, and this
            page is screenshotted every week. */}
        <div className="mb-3 flex justify-center gap-2">
          {(
            [
              ["artists", "Artists"],
              ["ai", "AI Artists"],
              ["battles", "Battle Wins"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setBoard(key)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                board === key
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-edge text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {data && (
          <p className="motr-label text-muted mb-5 text-center">
            {data.label}
            {data.range === "week" && " · closes Saturday at midnight"}
          </p>
        )}

        {failed && (
          <p className="text-muted py-10 text-center text-sm">
            Couldn&apos;t load the charts. Check back in a moment.
          </p>
        )}

        {!data && !failed && (
          <p className="text-muted py-10 text-center text-sm">Loading...</p>
        )}

        {data && (
          <div className="space-y-6">
            <section hidden={board !== "artists"}>
              <h2 className="motr-label text-gold mb-3">Top artists</h2>
              <p className="text-muted mb-3 text-xs leading-relaxed">
                {/* Each older rule is said out loud for the weeks it decided,
                    so a look-back explains itself. */}
                {range === "week" && (data.week ?? "") < "2026-11-15"
                  ? "Every song an artist had, added together. That was the rule for weeks before November 15."
                  : range === "week" && data.aiChart === false
                    ? "Each artist's two best songs, added together. Songs with AI vocals got a chart of their own from November 22."
                    : "Each artist's two best songs, added together. An artist with songs of both kinds is on whichever chart they are stronger on this week."}
              </p>
              {data.artists.length === 0 ? (
                <Empty />
              ) : (
                <ol className="space-y-1.5">
                  {data.artists.map((artist) => (
                    <li
                      key={artist.id}
                      className="border-edge bg-surface flex items-center gap-3 rounded-xl border px-3 py-2"
                    >
                      <Rank n={artist.rank} />
                      <span className="min-w-0 flex-1 truncate font-medium">{artist.name}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section hidden={board !== "ai"}>
              <h2 className="motr-label text-gold mb-3">AI artists</h2>
              <p className="text-muted mb-3 text-xs leading-relaxed">
                Songs with AI vocals, on a chart of their own so neither kind is ranked against the
                other. Each artist&apos;s two best, added together, with its own weekly winner and
                write-up. An artist is on one chart a week, whichever they are stronger on.
              </p>
              {data.aiChart === false ? (
                <p className="border-edge bg-surface text-muted rounded-xl border p-4 text-sm leading-relaxed">
                  The AI Artists chart starts with the week of November 22. Before that, every song
                  was on one chart.
                </p>
              ) : (data.aiArtists ?? []).length === 0 ? (
                <Empty />
              ) : (
                <ol className="space-y-1.5">
                  {(data.aiArtists ?? []).map((artist) => (
                    <li
                      key={artist.id}
                      className="border-edge bg-surface flex items-center gap-3 rounded-xl border px-3 py-2"
                    >
                      <Rank n={artist.rank} />
                      <span className="min-w-0 flex-1 truncate font-medium">{artist.name}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section hidden={board !== "battles"}>
              <h2 className="motr-label text-gold mb-3">Battle wins</h2>
              <p className="text-muted mb-3 text-xs leading-relaxed">
                Two songs from one genre, no names, and listeners pick one. Whoever has the
                bigger share when the week closes takes the win. This board stands alone: it has
                no effect on either artist chart or on the weekly winners.
              </p>
              {(data.battles ?? []).length === 0 ? (
                <Empty />
              ) : (
                <ol className="space-y-1.5">
                  {(data.battles ?? []).map((artist) => (
                    <li
                      key={artist.id}
                      className="border-edge bg-surface flex items-center gap-3 rounded-xl border px-3 py-2"
                    >
                      <Rank n={artist.rank} />
                      <span className="min-w-0 flex-1 truncate font-medium">{artist.name}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <p className="text-muted/70 pb-2 text-center text-xs leading-relaxed">
              Updated continuously. Position is earned by listeners keeping the song, and there is
              no way to buy a place on this list.
            </p>
          </div>
        )}
      </div>
    </MotrShell>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span
      className={`w-6 shrink-0 text-center text-lg font-bold tabular-nums ${
        n <= 3 ? "text-gold" : "text-muted"
      }`}
    >
      {n}
    </span>
  );
}

function Empty() {
  return (
    <p className="border-edge bg-surface text-muted rounded-xl border p-4 text-sm leading-relaxed">
      Nothing has been played in this period yet. The chart fills in as people swipe.
    </p>
  );
}
