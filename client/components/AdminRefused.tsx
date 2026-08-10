"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection, { ShowMore, useVisibleCount } from "./AdminSection";
import { GENRES } from "@/lib/genres";

type Refused = {
  id: string;
  spotifyUrl: string;
  artistEmail: string;
  genre: string | null;
  reason: string;
  attempts: number;
  status: "PENDING" | "ADDED" | "DISMISSED";
  createdAt: string;
};

const VIEWS = [
  { key: "pending", label: "Needs you" },
  { key: "handled", label: "Handled" },
  { key: "all", label: "All" },
] as const;

/**
 * Submissions the lookup wouldn't accept.
 *
 * The artist's email and genre are kept from their original attempt, so a
 * track can be added on their behalf — they submitted once, and shouldn't
 * have to do it again because our matching couldn't confirm the recording.
 */
export default function AdminRefused({ onChanged }: { onChanged: () => void }) {
  const [view, setView] = useState<(typeof VIEWS)[number]["key"]>("pending");
  const [items, setItems] = useState<Refused[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [genreDraft, setGenreDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const page = useVisibleCount(10);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/refused?view=${view}`);
    if (!res.ok) return;
    const d = await res.json();
    setItems(d.items);
    setPendingCount(d.pendingCount);
  }, [view]);

  useEffect(() => {
    load();
    page.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function act(r: Refused, action: "ADD" | "DISMISS" | "REOPEN") {
    setBusy(r.id);
    setFlash(null);
    const res = await fetch("/api/admin/refused", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: r.id,
        action,
        spotifyUrl: action === "ADD" ? linkDraft.trim() || undefined : undefined,
        genre: action === "ADD" ? genreDraft || undefined : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setFlash(data.error ?? "That didn't work.");
      return;
    }
    if (action === "ADD") {
      setOpenId(null);
      setLinkDraft("");
      setGenreDraft("");
      setFlash(
        data.alreadyExisted
          ? "That track was already in the feed — marked handled."
          : `Added "${data.track.title}" by ${data.track.artistName} for ${data.artist.email}.`
      );
    }
    load();
    onChanged();
  }

  return (
    <AdminSection
      title="Failed submissions"
      description="Tracks we refused rather than risk attaching the wrong audio. Their details are kept so you can add them without the artist resubmitting."
      defaultOpen={false}
      badge={
        pendingCount > 0 ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
            {pendingCount} needing you
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              view === v.key
                ? "bg-gold text-bg"
                : "border border-edge text-muted transition hover:border-gold/50 hover:text-white"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {flash && (
        <p className="mt-3 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-muted">
          {flash}
        </p>
      )}

      {items === null ? (
        <p className="mt-4 text-sm text-muted">Loading...</p>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
          <p className="font-medium text-emerald-300">Nothing waiting</p>
          <p className="mt-1 text-sm text-muted">
            Every submission so far was verified and added automatically.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.slice(0, page.visible).map((r) => {
            const open = openId === r.id;
            return (
              <li key={r.id} className="rounded-xl border border-edge bg-surface">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.artistEmail}</span>
                      {r.status !== "PENDING" && (
                        <span className="rounded-full border border-edge px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-muted">
                          {r.status.toLowerCase()}
                        </span>
                      )}
                      {r.attempts > 1 && (
                        <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[0.6rem] text-amber-300">
                          tried {r.attempts}×
                        </span>
                      )}
                    </p>
                    <a
                      href={r.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all text-xs text-gold underline underline-offset-2"
                    >
                      {r.spotifyUrl}
                    </a>
                    <p className="mt-1.5 text-xs text-muted">
                      {r.genre ? `${r.genre} · ` : ""}
                      {new Date(r.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1.5 text-xs italic text-muted">{r.reason}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {r.status === "PENDING" ? (
                      <>
                        <button
                          onClick={() => {
                            setOpenId(open ? null : r.id);
                            setLinkDraft("");
                            setGenreDraft(r.genre ?? "");
                          }}
                          className="rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-bg"
                        >
                          {open ? "Cancel" : "Add it"}
                        </button>
                        <button
                          onClick={() => act(r, "DISMISS")}
                          disabled={busy === r.id}
                          className="rounded-full border border-edge px-4 py-1.5 text-sm text-muted transition hover:border-nope/50 hover:text-nope disabled:opacity-40"
                        >
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => act(r, "REOPEN")}
                        disabled={busy === r.id}
                        className="rounded-full border border-edge px-4 py-1.5 text-sm font-semibold transition hover:border-gold hover:text-gold disabled:opacity-40"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="border-t border-edge p-4">
                    <p className="text-xs text-muted">
                      Leave the link blank to retry theirs, or paste a corrected Spotify link.
                      It&apos;s verified the same way a submission is, and the track is attached
                      to <strong className="text-white">{r.artistEmail}</strong> — they
                      don&apos;t resubmit anything.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        value={linkDraft}
                        onChange={(e) => setLinkDraft(e.target.value)}
                        placeholder={r.spotifyUrl}
                        className="min-w-[240px] flex-1 rounded-lg border border-edge bg-bg px-3 py-2 text-sm outline-none transition focus:border-gold placeholder:text-neutral-600"
                      />
                      <select
                        value={genreDraft}
                        onChange={(e) => setGenreDraft(e.target.value)}
                        className="rounded-lg border border-edge bg-bg px-3 py-2 text-sm outline-none focus:border-gold"
                      >
                        <option value="">Keep their genre</option>
                        {GENRES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => act(r, "ADD")}
                        disabled={busy === r.id}
                        className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-bg disabled:opacity-40"
                      >
                        {busy === r.id ? "Checking..." : "Add to feed"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items && items.length > 0 && (
        <ShowMore
          shown={page.visible}
          total={items.length}
          onMore={page.more}
          onLess={page.reset}
        />
      )}
    </AdminSection>
  );
}
