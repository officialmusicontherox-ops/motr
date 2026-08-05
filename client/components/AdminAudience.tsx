"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection, { ShowMore, useVisibleCount } from "./AdminSection";

type Totals = {
  google: number;
  anonymous: number;
  activeGoogle: number;
  activeAnon: number;
  savedTotal: number;
  swipedEver: number;
  registered: number;
};

type AudienceFan = {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  createdAt: string;
  swipes: number;
};

type SavedTrack = {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  genre: string | null;
  status: string;
  saves: number;
  votes: number;
  lastSavedAt: string | null;
};

/**
 * Splits the fan base by sign-in method. A signed-in fan keeps their saves
 * across devices and can be contacted; an anonymous fan is a swipe and
 * nothing else.
 */
export default function AdminAudience() {
  const [type, setType] = useState<"google" | "anonymous">("google");
  const [totals, setTotals] = useState<Totals | null>(null);
  const [fans, setFans] = useState<AudienceFan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSaves, setShowSaves] = useState(false);

  const load = useCallback(async (t: "google" | "anonymous") => {
    setFans(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/audience?type=${t}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const d = await res.json();
      setTotals(d.totals);
      setFans(d.fans);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audience");
    }
  }, []);

  useEffect(() => {
    load(type);
  }, [type, load]);

  return (
    <AdminSection
      title="Audience"
      description="Everyone swiping the feed, split by how they signed in."
    >
      {totals && (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Tile
            label="Google sign-ins"
            value={totals.google}
            sub={`${totals.activeGoogle} active this week`}
            gold
          />
          <Tile
            label="Anonymous"
            value={totals.anonymous}
            sub={`${totals.activeAnon} active this week`}
          />
          {/* Opens the per-track breakdown. The aggregate is the least
              interesting thing about this number — which tracks earned it is
              the whole product. */}
          <Tile
            label="Tracks saved"
            value={totals.savedTotal}
            sub={showSaves ? "hide the breakdown" : "see every track ▾"}
            onClick={() => setShowSaves((s) => !s)}
            open={showSaves}
          />
          {/* The number that means something. A share link creates a listener
              on click, so the raw total counts bounces and link previews. */}
          <Tile
            label="Swiped at least once"
            value={totals.swipedEver}
            sub={`of ${totals.registered} who arrived`}
            gold
          />
        </div>
      )}

      {showSaves && <SavedBreakdown />}

      <div className="mt-4 flex gap-2">
        {(["google", "anonymous"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full px-4 py-1.5 text-sm capitalize ${
              type === t
                ? "bg-gold text-bg"
                : "border border-edge text-muted transition hover:border-gold/50 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-nope">Couldn&apos;t load audience: {error}</p>
      ) : fans === null ? (
        <p className="mt-3 text-sm text-muted">Loading...</p>
      ) : fans.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No {type === "google" ? "Google sign-ins" : "anonymous fans"} yet.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="p-3">Fan</th>
                <th className="p-3">Swipes</th>
                <th className="p-3">Joined</th>
                {type === "google" && <th className="p-3">Email</th>}
              </tr>
            </thead>
            <tbody>
              {fans.map((f) => (
                <tr key={f.id} className="border-t border-edge">
                  <td className="max-w-[18rem] truncate p-3">
                    {f.displayName ?? f.username}
                    {f.displayName && (
                      <span className="text-muted"> · {f.username}</span>
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{f.swipes}</td>
                  <td className="p-3 text-muted">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </td>
                  {type === "google" && (
                    <td className="max-w-[18rem] truncate p-3 text-muted">{f.email ?? "—"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminSection>
  );
}

function Tile({
  label,
  value,
  sub,
  suffix,
  gold,
  onClick,
  open,
}: {
  label: string;
  value: number;
  sub?: string;
  suffix?: string;
  gold?: boolean;
  /** Makes the tile a button that reveals detail underneath. */
  onClick?: () => void;
  open?: boolean;
}) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${gold ? "text-gold" : ""}`}>
        {value.toLocaleString()}
        {suffix}
      </p>
      {sub && <p className={`text-xs ${onClick ? "text-gold" : "text-muted"}`}>{sub}</p>}
    </>
  );

  if (!onClick) {
    return <div className="rounded-xl border border-edge bg-surface p-4">{body}</div>;
  }

  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      className={`rounded-xl border bg-surface p-4 text-left transition hover:border-gold ${
        open ? "border-gold" : "border-edge"
      }`}
    >
      {body}
    </button>
  );
}

const SAVE_SORTS = [
  { key: "saves", label: "Most saved" },
  { key: "savesAsc", label: "Fewest saved" },
  { key: "rate", label: "Highest save rate" },
  { key: "rateAsc", label: "Lowest save rate" },
  { key: "votes", label: "Most played" },
  { key: "recent", label: "Recently saved" },
  { key: "title", label: "Title A–Z" },
  { key: "artist", label: "Artist A–Z" },
] as const;

type SaveSort = (typeof SAVE_SORTS)[number]["key"];

const rate = (t: SavedTrack) => t.saves / t.votes;
const savedAt = (t: SavedTrack) => (t.lastSavedAt ? new Date(t.lastSavedAt).getTime() : 0);

const SAVE_COMPARATORS: Record<SaveSort, (a: SavedTrack, b: SavedTrack) => number> = {
  saves: (a, b) => b.saves - a.saves || b.votes - a.votes,
  savesAsc: (a, b) => a.saves - b.saves || a.votes - b.votes,
  // Ties on rate break toward the bigger sample — 5 of 5 is a firmer 100%
  // than 1 of 1, and putting the flukes on top would make the sort useless.
  rate: (a, b) => rate(b) - rate(a) || b.votes - a.votes,
  rateAsc: (a, b) => rate(a) - rate(b) || b.votes - a.votes,
  votes: (a, b) => b.votes - a.votes || b.saves - a.saves,
  recent: (a, b) => savedAt(b) - savedAt(a),
  title: (a, b) => a.title.localeCompare(b.title),
  artist: (a, b) => a.artistName.localeCompare(b.artistName) || a.title.localeCompare(b.title),
};

/**
 * Every saved track, most-saved first.
 *
 * Saves are shown against the votes each track took, because the raw count
 * rewards nothing but exposure — a track played to everyone will out-save a
 * better one played to fifty people. The rate is the verdict; the count is
 * the sample size behind it.
 */
function SavedBreakdown() {
  const [tracks, setTracks] = useState<SavedTrack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SaveSort>("saves");
  const { visible, more, reset } = useVisibleCount(10);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/audience/saves")
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((d) => live && setTracks(d.tracks))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load saves"));
    return () => {
      live = false;
    };
  }, []);

  if (error) return <p className="mt-4 text-sm text-nope">Couldn&apos;t load saves: {error}</p>;
  if (tracks === null) return <p className="mt-4 text-sm text-muted">Loading saves...</p>;
  if (tracks.length === 0)
    return <p className="mt-4 text-sm text-muted">Nothing has been saved yet.</p>;

  // Sorting the fetched array rather than refetching: the whole list is
  // already here, and re-ordering shouldn't cost a round trip.
  const ordered = [...tracks].sort(SAVE_COMPARATORS[sort]);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SaveSort);
            reset();
          }}
          aria-label="Sort saved tracks"
          className="rounded-full border border-edge bg-surface px-4 py-2 text-sm outline-none transition focus:border-gold"
        >
          {SAVE_SORTS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          {tracks.length.toLocaleString()} tracks have been saved at least once.
        </p>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-edge">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-muted">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Track</th>
              <th className="p-3">Saves</th>
              <th className="p-3">Votes</th>
              <th className="p-3">Rate</th>
              <th className="p-3">Last saved</th>
            </tr>
          </thead>
          <tbody>
            {ordered.slice(0, visible).map((t, i) => (
              <tr key={t.id} className="border-t border-edge">
                <td className="p-3 tabular-nums text-muted">{i + 1}</td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {t.artworkUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.artworkUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.title}</p>
                      <p className="truncate text-xs text-muted">
                        {t.artistName}
                        {t.genre && ` · ${t.genre}`}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-lg font-semibold tabular-nums text-gold">{t.saves}</td>
                <td className="p-3 tabular-nums text-muted">{t.votes}</td>
                <td className="p-3 tabular-nums">{Math.round((t.saves / t.votes) * 100)}%</td>
                <td className="whitespace-nowrap p-3 text-muted">
                  {t.lastSavedAt ? new Date(t.lastSavedAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ShowMore shown={visible} total={ordered.length} onMore={more} onLess={reset} />

      <p className="mt-3 text-xs text-muted">
        Rate is saves ÷ votes. It only means something once a track has taken a few dozen
        votes — a track played twice and saved twice reads as 100%.
      </p>
    </div>
  );
}
