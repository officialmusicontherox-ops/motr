"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection, { Pager, usePager } from "./AdminSection";

type Row = {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  genre: string | null;
  addedAt: string;
  account: string | null;
};

/**
 * Every song marked as AI vocals, in one place.
 *
 * Finding them used to mean searching the Tracks list song by song. Sorted
 * by artist, so an artist with several AI songs reads as one block, and
 * paged so a long list stays short on a phone. The dropdown on each row is
 * the same setting as on Tracks; setting a song to "no" or "not asked"
 * takes it off this list.
 */
export default function AdminAiTracks() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const page = usePager(20);

  const load = useCallback(() => {
    fetch("/api/admin/ai-tracks")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.tracks))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setAi(id: string, value: string) {
    setBusy(id);
    await fetch("/api/admin/tracks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trackId: id,
        action: "SET_AI",
        aiGenerated: value === "yes" ? true : value === "no" ? false : null,
      }),
    }).catch(() => {});
    setBusy(null);
    load();
  }

  const artists = rows ? new Set(rows.map((r) => r.artistName.toLowerCase())).size : 0;

  return (
    <AdminSection
      title="AI Vocals"
      description={
        rows ? `${rows.length} songs in rotation marked as AI vocals, from ${artists} artists` : "Songs marked as AI vocals"
      }
    >
      {failed ? (
        <p className="text-muted text-sm">Couldn&apos;t load.</p>
      ) : !rows ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">No songs are marked as AI vocals.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {page.slice(rows).map((r) => (
              <li key={r.id} className="border-edge bg-surface flex items-center gap-3 rounded-xl border p-3">
                {r.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.artworkUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="bg-surface-2 h-12 w-12 shrink-0 rounded-lg" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.artistName}</p>
                  <p className="text-muted truncate text-xs">{r.title}</p>
                  <p className="text-muted truncate text-xs">
                    {(r.genre ?? "No genre").split(" /")[0]}
                    {r.account ? ` · ${r.account}` : ""} · added {new Date(r.addedAt).toLocaleDateString()}
                  </p>
                </div>
                <select
                  aria-label={`AI vocals for ${r.title}`}
                  value="yes"
                  disabled={busy === r.id}
                  onChange={(e) => void setAi(r.id, e.target.value)}
                  className="border-gold/50 text-gold bg-bg shrink-0 rounded-md border px-2 py-1 text-xs outline-none disabled:opacity-40"
                >
                  <option value="yes">AI vocals: yes</option>
                  <option value="no">AI vocals: no</option>
                  <option value="">AI vocals: not asked</option>
                </select>
              </li>
            ))}
          </ul>
          <Pager page={page.page} pageSize={page.pageSize} total={rows.length} onPage={page.setPage} />
        </>
      )}
    </AdminSection>
  );
}
