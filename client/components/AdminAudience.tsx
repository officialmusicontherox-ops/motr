"use client";

import { useCallback, useEffect, useState } from "react";

type Totals = {
  spotify: number;
  anonymous: number;
  activeSpotify: number;
  activeAnon: number;
  savedToLibrary: number;
};

type AudienceFan = {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: string;
  swipes: number;
  connected: boolean;
};

/**
 * Splits the fan base by sign-in method. Spotify fans are the ones we can
 * push library saves to; anonymous fans only ever contribute swipe votes.
 */
export default function AdminAudience() {
  const [type, setType] = useState<"spotify" | "anonymous">("spotify");
  const [totals, setTotals] = useState<Totals | null>(null);
  const [fans, setFans] = useState<AudienceFan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: "spotify" | "anonymous") => {
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
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Audience</h2>
      <p className="text-sm text-muted">
        Everyone swiping the feed, split by how they signed in.
      </p>

      {totals && (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Tile
            label="Spotify sign-ins"
            value={totals.spotify}
            sub={`${totals.activeSpotify} active this week`}
            gold
          />
          <Tile
            label="Anonymous"
            value={totals.anonymous}
            sub={`${totals.activeAnon} active this week`}
          />
          <Tile
            label="Saved to Spotify"
            value={totals.savedToLibrary}
            sub="tracks pushed to libraries"
          />
          <Tile
            label="Connected share"
            value={
              totals.spotify + totals.anonymous === 0
                ? 0
                : Math.round((totals.spotify / (totals.spotify + totals.anonymous)) * 100)
            }
            suffix="%"
            sub="of fans linked Spotify"
          />
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {(["spotify", "anonymous"] as const).map((t) => (
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
          No {type === "spotify" ? "Spotify sign-ins" : "anonymous fans"} yet.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="p-3">Fan</th>
                <th className="p-3">Swipes</th>
                <th className="p-3">Joined</th>
                {type === "spotify" && <th className="p-3">Connection</th>}
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
                  {type === "spotify" && (
                    <td className="p-3">
                      {f.connected ? (
                        <span className="text-hot">Linked</span>
                      ) : (
                        <span className="text-muted">Needs reconnect</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  sub,
  suffix,
  gold,
}: {
  label: string;
  value: number;
  sub?: string;
  suffix?: string;
  gold?: boolean;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${gold ? "text-gold" : ""}`}>
        {value.toLocaleString()}
        {suffix}
      </p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
