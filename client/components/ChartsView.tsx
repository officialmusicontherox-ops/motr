"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import { useRefreshOnReturn } from "@/lib/useRefreshOnReturn";

type ChartSong = {
  rank: number;
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
};

type ChartArtist = { rank: number; id: string; name: string; tracks: number };

type Charts = { songs: ChartSong[]; artists: ChartArtist[]; since: string; days: number };

type Range = "week" | "month";

/** Often enough to feel live, rarely enough not to matter on the bill. */
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
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/charts?range=${range}`, { cache: "no-store" });
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
  }, [range]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useRefreshOnReturn(load);

  return (
    <MotrShell>
      <div className="w-full max-w-md">
        <header className="mb-4 text-center">
          <h1 className="font-display text-2xl uppercase tracking-wide">Charts</h1>
          <p className="text-muted mt-1.5 text-sm leading-relaxed">
            The tracks listeners backed hardest, heard with no artist name attached.
          </p>
        </header>

        <div className="mb-5 flex justify-center gap-2">
          {(
            [
              ["week", "This week"],
              ["month", "This month"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRange(key)}
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
            <section>
              <h2 className="motr-label text-gold mb-3">Top songs</h2>
              {data.songs.length === 0 ? (
                <Empty />
              ) : (
                <ol className="space-y-2">
                  {data.songs.map((song) => (
                    <li
                      key={song.id}
                      className="border-edge bg-surface flex items-center gap-3 rounded-xl border p-3"
                    >
                      <Rank n={song.rank} />
                      {song.artworkUrl ? (
                        <Image
                          src={song.artworkUrl}
                          alt=""
                          width={44}
                          height={44}
                          unoptimized
                          className="h-11 w-11 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="bg-surface-2 h-11 w-11 shrink-0 rounded-lg" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{song.title}</span>
                        <span className="text-muted block truncate text-sm">
                          {song.artistName}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section>
              <h2 className="motr-label text-gold mb-3">Top artists</h2>
              {data.artists.length === 0 ? (
                <Empty />
              ) : (
                <ol className="space-y-2">
                  {data.artists.map((artist) => (
                    <li
                      key={artist.id}
                      className="border-edge bg-surface flex items-center gap-3 rounded-xl border p-3"
                    >
                      <Rank n={artist.rank} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{artist.name}</span>
                        <span className="text-muted block truncate text-sm">
                          {artist.tracks} track{artist.tracks === 1 ? "" : "s"} in the feed
                        </span>
                      </span>
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
