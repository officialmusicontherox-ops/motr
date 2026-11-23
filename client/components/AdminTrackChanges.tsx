"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminSection, { Pager, usePager } from "./AdminSection";
import { Pause, Play } from "./icons";

type Req = {
  id: string;
  at: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  previewUrl: string;
  genre: { from: string | null; to: string } | null;
  ai: { from: boolean | null; to: boolean } | null;
};

const aiWord = (v: boolean | null) => (v === null ? "not asked" : v ? "yes" : "no");

/**
 * Artists asking to change a song's genre or AI-vocals label from their own
 * page. Nothing on the song changes until it is approved here. The cover
 * plays the clip, so the AI answer can be checked by ear first.
 */
export default function AdminTrackChanges() {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const page = usePager(10);

  const load = useCallback(() => {
    fetch("/api/admin/track-changes")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.requests))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => () => audio.current?.pause(), []);

  function preview(r: Req) {
    audio.current?.pause();
    if (playing === r.id) {
      setPlaying(null);
      return;
    }
    const a = new Audio(r.previewUrl);
    audio.current = a;
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
    setPlaying(r.id);
  }

  async function decide(id: string, action: "APPROVE" | "DECLINE") {
    setBusy(id);
    await fetch("/api/admin/track-changes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    }).catch(() => {});
    setBusy(null);
    load();
  }

  const last = rows ? Math.max(0, Math.ceil(rows.length / page.pageSize) - 1) : 0;
  const shown = Math.min(page.page, last);

  return (
    <AdminSection
      title="Song change requests"
      description={
        !rows
          ? "Artists asking to change a song's genre or AI vocals"
          : rows.length === 0
            ? "Nothing waiting for approval"
            : `${rows.length} waiting for approval. Nothing changes until you approve it.`
      }
    >
      {failed ? (
        <p className="text-muted text-sm">Couldn&apos;t load.</p>
      ) : !rows ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : rows.length === 0 ? null : (
        <>
          <ul className="space-y-2">
            {rows.slice(shown * page.pageSize, shown * page.pageSize + page.pageSize).map((r) => (
              <li key={r.id} className="border-edge bg-surface rounded-xl border p-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => preview(r)}
                    aria-label={playing === r.id ? `Pause ${r.title}` : `Play ${r.title}`}
                    className="bg-surface-2 relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"
                  >
                    {r.artworkUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.artworkUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                      {playing === r.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <p className="text-muted truncate text-xs">
                      {r.artistName} · {new Date(r.at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-2 space-y-0.5 text-xs">
                  {r.genre && (
                    <p>
                      <span className="text-muted">Genre: </span>
                      {r.genre.from ?? "none"} <span className="text-muted">to</span>{" "}
                      <span className="text-gold font-semibold">{r.genre.to}</span>
                    </p>
                  )}
                  {r.ai && (
                    <p>
                      <span className="text-muted">AI vocals: </span>
                      {aiWord(r.ai.from)} <span className="text-muted">to</span>{" "}
                      <span className="text-gold font-semibold">{aiWord(r.ai.to)}</span>
                    </p>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void decide(r.id, "APPROVE")}
                    disabled={busy === r.id}
                    className="bg-gold text-bg flex-1 rounded-full py-2 text-xs font-bold disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void decide(r.id, "DECLINE")}
                    disabled={busy === r.id}
                    className="border-edge text-muted hover:text-ink flex-1 rounded-full border py-2 text-xs font-semibold transition disabled:opacity-40"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Pager page={shown} pageSize={page.pageSize} total={rows.length} onPage={page.setPage} />
        </>
      )}
    </AdminSection>
  );
}
