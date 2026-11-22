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
  const [show, setShow] = useState<"ai" | "unasked">("ai");

  const load = useCallback(() => {
    fetch(`/api/admin/ai-tracks${show === "unasked" ? "?show=unasked" : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.tracks))
      .catch(() => setFailed(true));
  }, [show]);

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
  // Never past the last page: re-marking the last song on it would
  // otherwise leave an empty page with no Back button.
  const last = rows ? Math.max(0, Math.ceil(rows.length / page.pageSize) - 1) : 0;
  const shown = Math.min(page.page, last);

  return (
    <AdminSection
      title="AI Vocals"
      description={
        !rows
          ? "Songs by AI-vocals label"
          : show === "ai"
            ? `${rows.length} songs marked as AI vocals, from ${artists} artists`
            : `${rows.length} songs never labelled, from ${artists} artists. Listeners who switch AI off still hear these until they are marked.`
      }
    >
      <div className="mb-4 flex gap-2">
        {(
          [
            { key: "ai", label: "Marked AI" },
            { key: "unasked", label: "Not asked yet" },
          ] as const
        ).map((v) => (
          <button
            key={v.key}
            onClick={() => {
              if (show === v.key) return;
              setShow(v.key);
              setRows(null);
              page.reset();
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              show === v.key
                ? "bg-gold text-bg"
                : "border-edge text-muted hover:border-gold/50 hover:text-ink border transition"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {failed ? (
        <p className="text-muted text-sm">Couldn&apos;t load.</p>
      ) : !rows ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">
          {show === "ai" ? "No songs are marked as AI vocals." : "Every song has been labelled."}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.slice(shown * page.pageSize, shown * page.pageSize + page.pageSize).map((r) => (
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
                  value={show === "ai" ? "yes" : ""}
                  disabled={busy === r.id}
                  onChange={(e) => void setAi(r.id, e.target.value)}
                  className={`bg-bg shrink-0 rounded-md border px-2 py-1 text-xs outline-none disabled:opacity-40 ${
                    show === "ai" ? "border-gold/50 text-gold" : "border-edge"
                  }`}
                >
                  <option value="yes">AI vocals: yes</option>
                  <option value="no">AI vocals: no</option>
                  <option value="">AI vocals: not asked</option>
                </select>
              </li>
            ))}
          </ul>
          <Pager page={shown} pageSize={page.pageSize} total={rows.length} onPage={page.setPage} />
        </>
      )}
    </AdminSection>
  );
}
