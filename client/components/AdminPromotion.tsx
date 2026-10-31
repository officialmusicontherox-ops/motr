"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Artist = {
  artistId: string | null;
  artistName: string;
  tracks: number;
  shareOpens: number;
  broughtIn: number;
  savesFromThem: number;
  topTrack: string | null;
};

const WINDOWS = [7, 30, 90];

/**
 * Which artists can move an audience.
 *
 * A save rate says whether strangers liked a record not knowing whose it
 * was. This says whether the artist can bring people at all, which is the
 * harder thing to buy and the thing an A&R desk cannot read off a streaming
 * dashboard. Kept here beside A&R access because it is the same audience's
 * question, and it carries no addresses so it can go to a scout as it is.
 */
export default function AdminPromotion() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Artist[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promotion?days=${d}`);
      if (!res.ok) throw new Error("Could not load promotion.");
      const data = await res.json();
      setRows(data.artists);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const active = (rows ?? []).filter((r) => r.broughtIn > 0 || r.shareOpens > 0);
  const totalIn = active.reduce((t, r) => t + r.broughtIn, 0);

  return (
    <AdminSection
      title="Who brings an audience"
      description="Artists ranked by listeners they bring in themselves, not by how their record tests. The two are different signals and an A&R desk wants both."
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
            {d} days
          </button>
        ))}
      </div>

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}
      {busy && !rows && <p className="text-muted mt-3 text-sm">Loading...</p>}

      {rows && (
        <>
          <p className="text-muted mt-4 text-sm">
            {active.length} {active.length === 1 ? "artist has" : "artists have"} brought someone in
            or had a card opened, {totalIn} listeners between them.
          </p>

          <div className="mt-3 space-y-2">
            {active.map((r) => {
              const q = encodeURIComponent(r.artistName);
              const rate =
                r.broughtIn > 0 ? Math.round((r.savesFromThem / r.broughtIn) * 100) : null;
              return (
                <div
                  key={`${r.artistId ?? r.artistName}`}
                  className="border-edge bg-surface rounded-xl border px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <strong>{r.artistName}</strong>
                    <span className="text-gold font-semibold tabular-nums">
                      {r.broughtIn} brought in
                    </span>
                  </div>
                  <div className="text-muted mt-1 text-xs">
                    {r.shareOpens} card {r.shareOpens === 1 ? "open" : "opens"} · {r.tracks}{" "}
                    {r.tracks === 1 ? "track" : "tracks"}
                    {r.topTrack && ` · best: ${r.topTrack}`}
                    {rate !== null && ` · ${rate}% of them saved it`}
                  </div>
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
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-muted mt-4 text-xs leading-relaxed">
            An arrival is attributed to the first track a new listener gave a verdict on, because a
            share link does not record which track it came from. Card opens are all time; arrivals
            are the window. Nothing here contains an address, so it can go to a scout as it stands.
          </p>
        </>
      )}
    </AdminSection>
  );
}
