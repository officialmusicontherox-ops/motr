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
};

type Payload = {
  scout: { name: string };
  tracks: ScoutTrack[];
  summary: {
    tracks: number;
    swipes: number;
    countries: { name: string; swipes: number }[];
    genres: string[];
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
    return <p className="text-nope p-8 text-center text-sm">Couldn&apos;t load the catalogue.</p>;
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
          no artwork they recognised and no idea who made it. It is what a record does before
          anyone&apos;s marketing touches it.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tracks" value={data.summary.tracks.toLocaleString()} />
        <Stat label="Blind verdicts" value={data.summary.swipes.toLocaleString()} />
        <Stat label="Countries" value={String(data.summary.countries.length)} />
        <Stat label="Signed in as" value={data.scout.name} small />
      </div>

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
