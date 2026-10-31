"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Row = {
  trackId: string;
  title: string;
  artist: string | null;
  artistEmail: string | null;
  arrived: number;
  saves: number;
  swipes: number;
  shareOpens: number;
};

type Data = {
  days: number;
  newListeners: number;
  shareVisits: number;
  views: number;
  rows: Row[];
  referrers: { host: string; views: number }[];
};

const WINDOWS = [2, 7, 14, 30];

/** Where a referrer host came from, in words rather than a hostname. */
function source(host: string): string {
  const h = host.toLowerCase();
  if (h.includes("facebook")) return "Facebook";
  if (h.includes("instagram")) return "Instagram";
  if (h.includes("tiktok")) return "TikTok";
  if (h.includes("google") && h.includes("gm")) return "Gmail";
  if (h.includes("google") || h.includes("bing") || h.includes("duckduckgo")) return "Search";
  if (h.includes("t.co") || h.includes("twitter") || h === "x.com") return "X";
  if (h.includes("reddit")) return "Reddit";
  if (h.includes("youtube")) return "YouTube";
  return host;
}

/**
 * Who is sending listeners, and where to go and look.
 *
 * A share link does not record which track it came from, so the attribution
 * is the first track a new listener swiped: the song they landed on is the
 * song whose link they followed. The point of the panel is the last column,
 * which goes straight to that artist's socials, because the number only
 * tells you something happened and the post tells you what.
 */
export default function AdminReferrals() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/referrals?days=${d}`);
      if (!res.ok) throw new Error("Could not load referrals.");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  // Collapsed to the platform, so four Facebook hostnames read as one number.
  const bySource = new Map<string, number>();
  for (const r of data?.referrers ?? []) {
    bySource.set(source(r.host), (bySource.get(source(r.host)) ?? 0) + r.views);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);

  const top = data?.rows[0];

  return (
    <AdminSection
      title="Who is sending listeners"
      description="Which artist's share card brought people in, and where those people came from."
      defaultOpen={false}
    >
      <div className="flex flex-wrap gap-2">
        {WINDOWS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              days === d ? "bg-gold text-bg" : "border-edge text-muted hover:border-gold/50 border"
            }`}
          >
            {d === 2 ? "48 hours" : `${d} days`}
          </button>
        ))}
      </div>

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}
      {busy && !data && <p className="text-muted mt-3 text-sm">Loading...</p>}

      {data && (
        <>
          <p className="mt-4 text-sm">
            <strong className="text-gold">{data.newListeners}</strong> new listeners
            <span className="text-muted">
              {" "}
              · {data.shareVisits} arrivals through a share link · {data.views} page views
            </span>
          </p>

          {/* The headline, because the usual answer is one artist and it is
              worth saying rather than making someone read a table for it. */}
          {top && top.arrived > 0 && (
            <p className="border-gold/40 bg-gold/10 mt-3 rounded-xl border p-3 text-sm leading-relaxed">
              Most of it is <strong className="text-gold">{top.artist ?? "an unlinked track"}</strong>
              , whose card for <em>{top.title}</em> brought {top.arrived} of them in.
            </p>
          )}

          {sources.length > 0 && (
            <div className="mt-4">
              <p className="motr-label text-muted mb-2">Where from</p>
              <div className="flex flex-wrap gap-2">
                {sources.map(([name, views]) => (
                  <span
                    key={name}
                    className="border-edge bg-surface rounded-full border px-3 py-1 text-xs"
                  >
                    {name} <span className="text-gold font-semibold">{views}</span>
                  </span>
                ))}
              </div>
              <p className="text-muted mt-2 text-xs">
                Visits with no referrer are left out. An in-app browser strips it, so the real
                social numbers are higher than these.
              </p>
            </div>
          )}

          <div className="mt-5">
            <p className="motr-label text-muted mb-2">Arrived on</p>
            {data.rows.length === 0 && (
              <p className="text-muted text-sm">Nobody new arrived in this window.</p>
            )}
            <div className="space-y-2">
              {data.rows
                .filter((r) => r.arrived > 0)
                .map((r) => {
                  const q = encodeURIComponent(r.artist ?? r.title);
                  const rate = r.swipes > 0 ? Math.round((r.saves / r.swipes) * 100) : null;
                  return (
                    <div
                      key={r.trackId}
                      className="border-edge bg-surface rounded-xl border px-3 py-2.5 text-sm"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span>
                          <strong>{r.artist ?? "No artist linked"}</strong>
                          <span className="text-muted"> · {r.title}</span>
                        </span>
                        <span className="text-gold font-semibold tabular-nums">
                          {r.arrived} {r.arrived === 1 ? "listener" : "listeners"}
                        </span>
                      </div>
                      <div className="text-muted mt-1 text-xs">
                        {r.shareOpens} share opens · {r.swipes} swipes · {r.saves} saves
                        {rate !== null && ` · ${rate}% saved`}
                      </div>
                      {/* The whole point: go and look at the post. */}
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                        <a
                          className="text-gold hover:underline"
                          href={`https://www.facebook.com/search/top?q=${q}`}
                          target="_blank"
                          rel="noopener"
                        >
                          Facebook
                        </a>
                        <a
                          className="text-gold hover:underline"
                          href={`https://www.instagram.com/explore/search/keyword/?q=${q}`}
                          target="_blank"
                          rel="noopener"
                        >
                          Instagram
                        </a>
                        <a
                          className="text-gold hover:underline"
                          href={`https://www.google.com/search?q=${q}`}
                          target="_blank"
                          rel="noopener"
                        >
                          Search
                        </a>
                        {r.artistEmail && (
                          <a className="text-muted hover:underline" href={`mailto:${r.artistEmail}`}>
                            Email them
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </AdminSection>
  );
}
