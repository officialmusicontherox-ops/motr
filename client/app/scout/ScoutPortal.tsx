"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type ScoutTrack = {
  id: string;
  title: string;
  artistName: string;
  genre: string | null;
  artworkUrl: string | null;
  rightSwipes: number;
  leftSwipes: number;
  totalSwipes: number;
  saveRate: number | null;
  fullListenRate: number | null;
  medianDecisionMs: number | null;
  firstSwipeAt: string | null;
  lastSwipeAt: string | null;
  topCountries: { name: string; swipes: number }[];
  topRegions: { name: string; swipes: number }[];
  benchmark: {
    deltaPoints: number;
    beats: { title: string; artistName: string; saveRate: number }[];
  } | null;
};

type WeeklySong = {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  saves: number;
  verdicts: number;
};

type WeeklyArtist = {
  artistId: string;
  name: string;
  saves: number;
  verdicts: number;
  tracks: number;
};

type Payload = {
  scout: { name: string };
  tracks: ScoutTrack[];
  weekly: { songs: WeeklySong[]; artists: WeeklyArtist[]; since: string };
  summary: {
    tracks: number;
    swipes: number;
    countries: { name: string; swipes: number }[];
    genres: string[];
    benchmark: {
      saveRate: number | null;
      verdicts: number;
      tracks: { title: string; artistName: string; saveRate: number; verdicts: number }[];
    };
  };
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/**
 * The A&R view.
 *
 * Everything here is something only a blind-swipe platform can know. Follower
 * counts and stream totals are deliberately absent: they are available from a
 * dozen places, all of them better sourced than we would be, and quoting them
 * would invite the comparison rather than the subscription.
 */
export default function ScoutPortal() {
  const [data, setData] = useState<Payload | null>(null);
  const [genre, setGenre] = useState<string>("");
  const [sort, setSort] = useState<"recent" | "saveRate" | "swipes">("swipes");
  const [state, setState] = useState<"loading" | "ready" | "unauthorised" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ sort });
      if (genre) q.set("genre", genre);
      const res = await fetch(`/api/scout/catalogue?${q}`);
      if (res.status === 401 || res.status === 403) {
        setState("unauthorised");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      setData(await res.json());
      setState("ready");
    } catch {
      setState("error");
    }
  }, [genre, sort]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === "unauthorised") return <SignIn />;

  if (state === "loading") {
    return <p className="text-muted p-8 text-center text-sm">Loading...</p>;
  }

  if (state === "error" || !data) {
    return <p className="text-nope p-8 text-center text-sm">Couldn&apos;t load the catalog.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="border-edge mb-6 border-b pb-5">
        <p className="motr-label text-gold">MOTR · A&amp;R</p>
        <h1 className="font-display mt-1 text-3xl uppercase tracking-wide">
          Blind performance
        </h1>
        <p className="text-muted mt-2 max-w-2xl text-sm leading-relaxed">
          Every number here comes from listeners who heard thirty seconds with no artist name,
          no artwork they recognized and no idea who made it. It is what a record does before
          anyone&apos;s marketing touches it.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tracks" value={data.summary.tracks.toLocaleString()} />
        <Stat label="Blind verdicts" value={data.summary.swipes.toLocaleString()} />
        <Stat
          label="Countries"
          value={
            data.summary.countries.length > 0 ? String(data.summary.countries.length) : "—"
          }
        />
        <Stat label="Signed in as" value={data.scout.name} small />
      </div>

      {/* The yardstick, stated once at the top so every number below it has a
          meaning. Established records are swiped by the same listeners, in the
          same week, under the same blind rules — which is what makes the
          comparison worth anything. */}
      {data.summary.benchmark.saveRate !== null && (
        <div className="border-gold/30 bg-gold/5 mb-6 rounded-xl border p-4">
          <p className="motr-label text-gold">The yardstick</p>
          <p className="mt-1 text-sm leading-relaxed">
            Established, already-successful records in the same feed are saved{" "}
            <span className="text-gold font-bold">{pct(data.summary.benchmark.saveRate)}</span> of
            the time when nobody knows what they are —{" "}
            {data.summary.benchmark.verdicts.toLocaleString()} blind verdicts. Anything below
            beats that number under identical conditions.
          </p>
        </div>
      )}

      {/* The first thing a scout should see: who moved this week. A
          filterable catalogue makes the reader do the work; a leaderboard
          answers the question they came with. */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Leaderboard title="Top songs this week" empty="No swipes yet this week.">
          {data.weekly.songs.map((song, i) => (
            <LeaderRow
              key={song.id}
              rank={i + 1}
              primary={song.title}
              secondary={song.artistName}
              artworkUrl={song.artworkUrl}
              saves={song.saves}
              verdicts={song.verdicts}
            />
          ))}
        </Leaderboard>

        <Leaderboard title="Top artists this week" empty="No swipes yet this week.">
          {data.weekly.artists.map((artist, i) => (
            <LeaderRow
              key={artist.artistId}
              rank={i + 1}
              primary={artist.name}
              secondary={`${artist.tracks} track${artist.tracks === 1 ? "" : "s"} in rotation`}
              saves={artist.saves}
              verdicts={artist.verdicts}
            />
          ))}
        </Leaderboard>
      </div>

      <h2 className="font-display border-edge mb-4 border-t pt-6 text-xl uppercase tracking-wide">
        Full catalog
      </h2>

      <div className="mb-5 flex flex-wrap gap-2">
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="border-edge bg-surface rounded-full border px-4 py-2 text-sm"
        >
          <option value="">All genres</option>
          {data.summary.genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        {(
          [
            ["swipes", "Most heard"],
            ["saveRate", "Highest save rate"],
            ["recent", "Most recent"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              sort === key
                ? "border-gold bg-gold/10 text-gold"
                : "border-edge text-muted hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {data.tracks.map((t) => (
          <TrackRow key={t.id} track={t} />
        ))}
      </ul>

      {data.tracks.length === 0 && (
        <p className="text-muted py-10 text-center text-sm">
          No tracks have been heard in that genre yet.
        </p>
      )}
    </div>
  );
}

function Leaderboard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <div className="border-edge bg-surface rounded-xl border p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="motr-label text-gold">{title}</p>
        <p className="text-muted/70 text-[0.65rem] uppercase tracking-wider">
          Saves / heard
        </p>
      </div>
      {children.length === 0 ? (
        <p className="text-muted text-sm">{empty}</p>
      ) : (
        <ol className="space-y-2">{children}</ol>
      )}
    </div>
  );
}

function LeaderRow({
  rank,
  primary,
  secondary,
  artworkUrl,
  saves,
  verdicts,
}: {
  rank: number;
  primary: string;
  secondary: string;
  artworkUrl?: string | null;
  saves: number;
  verdicts: number;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="text-muted w-5 shrink-0 text-right text-sm tabular-nums">{rank}</span>
      {artworkUrl ? (
        <Image
          src={artworkUrl}
          alt=""
          width={36}
          height={36}
          unoptimized
          className="h-9 w-9 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="bg-surface-2 h-9 w-9 shrink-0 rounded" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{primary}</span>
        <span className="text-muted block truncate text-xs">{secondary}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="text-gold block text-sm font-bold tabular-nums">{saves}</span>
        {/* The denominator is shown but never used for ranking — see
            weeklyLeaders. Spelled out because "1 of 2" on its own is only
            obvious to whoever wrote it. */}
        <span className="text-muted block text-[0.65rem]">of {verdicts} heard</span>
      </span>
    </li>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="border-edge bg-surface rounded-xl border p-3">
      <p className="motr-label text-muted">{label}</p>
      <p className={`mt-1 font-semibold ${small ? "truncate text-sm" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function TrackRow({ track: t }: { track: ScoutTrack }) {
  const places = t.topRegions.length > 0 ? t.topRegions : t.topCountries;

  return (
    <li className="border-edge bg-surface rounded-xl border p-4">
      <div className="flex gap-4">
        {t.artworkUrl && (
          <Image
            src={t.artworkUrl}
            alt=""
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{t.title}</p>
          <p className="text-muted truncate text-sm">{t.artistName}</p>
          {t.genre && <p className="text-muted/70 mt-0.5 text-xs">{t.genre}</p>}
        </div>

        <div className="shrink-0 text-right">
          {/* The headline number. Null below the confidence floor, because a
              save rate off four verdicts is one person's opinion wearing a
              percentage sign — and a scout who acts on it and gets burned
              never trusts the next one. */}
          {t.saveRate === null ? (
            <p className="text-muted text-xs">Too early to rate</p>
          ) : (
            <>
              <p className="text-gold text-2xl font-bold tabular-nums">{pct(t.saveRate)}</p>
              <p className="motr-label text-muted">saved blind</p>
            </>
          )}
        </div>
      </div>

      <div className="border-edge mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-sm sm:grid-cols-4">
        <Cell label="Verdicts" value={t.totalSwipes.toLocaleString()} />
        <Cell label="Saves" value={t.rightSwipes.toLocaleString()} />
        <Cell
          label="Heard it out"
          value={t.fullListenRate === null ? "—" : pct(t.fullListenRate)}
          hint="Share who let all 30 seconds play before deciding"
        />
        <Cell
          label="Decision at"
          value={t.medianDecisionMs === null ? "—" : secs(t.medianDecisionMs)}
          hint="Median time into the clip before they chose"
        />
      </div>

      {/* The sentence worth paying for. Only ever shown when both sides of the
          comparison have earned a rate of their own. */}
      {t.benchmark && t.benchmark.deltaPoints > 0 && (
        <div className="border-gold/30 bg-gold/5 mt-3 rounded-lg border px-3 py-2">
          <p className="text-sm">
            <span className="text-gold font-bold">
              +{t.benchmark.deltaPoints} points
            </span>{" "}
            <span className="text-muted">above established records, blind.</span>
          </p>
          {t.benchmark.beats.length > 0 && (
            <p className="text-muted mt-1 text-xs">
              Outperformed{" "}
              {t.benchmark.beats.map((b, i) => (
                <span key={b.title}>
                  {i > 0 && " and "}
                  <span className="text-white">
                    &ldquo;{b.title}&rdquo; by {b.artistName}
                  </span>{" "}
                  ({pct(b.saveRate)})
                </span>
              ))}{" "}
              on the same listeners.
            </p>
          )}
        </div>
      )}

      {places.length > 0 && (
        <p className="text-muted mt-3 text-xs">
          <span className="motr-label">Catching in</span>{" "}
          {places.map((p, i) => (
            <span key={p.name}>
              {i > 0 && " · "}
              <span className="text-white">{p.name}</span> {p.swipes}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

function Cell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <p className="motr-label text-muted">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Shown when there's no session — the whole portal is behind this. */
function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/scout/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setSent(true);
    setBusy(false);
  }

  return (
    <main className="bg-bg flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="motr-label text-gold">MOTR · A&amp;R</p>
      <h1 className="font-display text-3xl uppercase tracking-wide">Sign in</h1>

      {sent ? (
        // Deliberately the same message whether or not the address exists —
        // otherwise this form tells anyone who asks which labels we work with.
        <p className="text-muted max-w-sm text-sm leading-relaxed">
          If that address has access, a sign-in link is on its way. It lasts 15 minutes and works
          once.
        </p>
      ) : (
        <form onSubmit={request} className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@label.com"
            className="border-edge bg-surface rounded-full border px-5 py-3 text-center text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-gold text-bg rounded-full px-6 py-3.5 text-sm font-bold uppercase tracking-wide disabled:opacity-40"
          >
            {busy ? "Sending..." : "Email me a link"}
          </button>
        </form>
      )}

      <p className="text-muted/70 max-w-xs text-xs leading-relaxed">
        Access is granted by MOTR. If you don&apos;t have it and want it, get in touch through
        musicontherox.com.
      </p>
    </main>
  );
}
