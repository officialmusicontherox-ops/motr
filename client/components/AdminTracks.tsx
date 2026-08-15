"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminSection, { ShowMore, useVisibleCount } from "./AdminSection";
import { GENRES } from "@/lib/genres";

type Track = {
  id: string;
  title: string;
  artistName: string;
  albumName: string | null;
  artworkUrl: string | null;
  previewUrl: string;
  genre: string | null;
  status: string;
  feeStatus: string;
  fanRightSwipes: number;
  fanLeftSwipes: number;
  weightedRightVotes: number;
  weightedTotalVotes: number;
  requiredFanVotes: number;
  requiredApprovalRate: number;
  addedAt: string;
  submittedBy: { name: string; email: string } | null;
  swipes: number;
  curatorsAssigned: number;
  previewSource: "iTunes" | "Deezer" | "Other";
  previewExpires: boolean;
  avgListenMs: number | null;
  measuredSwipes: number;
  convictionRate: number | null;
  votesThisWeek: number;
};

type Counts = { live: number; pulled: number; submitted: number; withCurators: number };

const SORTS = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "title", label: "Title A–Z" },
  { key: "artist", label: "Artist A–Z" },
  { key: "popular", label: "Most liked" },
] as const;

const VIEWS = [
  { key: "live", label: "In rotation", hint: "Playing in the fan feed right now" },
  { key: "submitted", label: "Artist submissions", hint: "Sent in by a real artist" },
  { key: "curators", label: "With curators", hint: "Paid for and routed out" },
  { key: "pulled", label: "Pulled", hint: "Removed from rotation" },
] as const;

export default function AdminTracks({ onChanged }: { onChanged: () => void }) {
  const [view, setView] = useState<(typeof VIEWS)[number]["key"]>("live");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("newest");
  const [q, setQ] = useState("");
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Track | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const page = useVisibleCount(10);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ view, sort });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/tracks?${params}`);
    if (!res.ok) return;
    const d = await res.json();
    setTracks(d.tracks);
    setCounts(d.counts);
  }, [view, sort, q]);

  useEffect(() => {
    setTracks(null);
    page.reset();
    const t = setTimeout(load, q ? 300 : 0); // debounce typing, not tab switches
    return () => clearTimeout(t);
    // page.reset is stable enough for this; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, q]);

  function preview(t: Track) {
    if (playing === t.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const a = new Audio(t.previewUrl);
    audioRef.current = a;
    a.play().catch(() => setPlaying(null));
    a.onended = () => setPlaying(null);
    setPlaying(t.id);
  }

  async function setGenre(t: Track, genre: string) {
    setBusy(t.id);
    await fetch("/api/admin/tracks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackId: t.id, action: "SET_GENRE", genre }),
    });
    setBusy(null);
    setFlash(`"${t.title}" moved to ${genre}. It'll route to ${genre} curators from now on.`);
    load();
  }

  async function setPreview(t: Track) {
    if (!linkDraft.trim()) return;
    setBusy(t.id);
    const res = await fetch("/api/admin/tracks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackId: t.id, action: "SET_PREVIEW", previewUrl: linkDraft.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setFlash(data.error ?? "That link didn't work.");
      return;
    }
    setFixing(null);
    setLinkDraft("");
    setFlash(
      data.via === "spotify"
        ? `Re-read from Spotify: now "${data.track.title}" by ${data.track.artistName}.`
        : `Audio replaced for "${t.title}".`
    );
    load();
  }

  async function act(t: Track, action: "PULL" | "RESTORE", note: string) {
    setBusy(t.id);
    const res = await fetch("/api/admin/tracks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackId: t.id, action, note }),
    });
    setBusy(null);
    setConfirming(null);
    if (!res.ok) return;
    setFlash(
      action === "PULL"
        ? `"${t.title}" pulled — fans won't be shown it again.`
        : `"${t.title}" is back in rotation.`
    );
    load();
    onChanged();
  }

  return (
    <AdminSection
      title="Tracks"
      description="Everything on the platform. Pull anything that shouldn't be playing."
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as (typeof SORTS)[number]["key"])}
            aria-label="Sort tracks"
            className="rounded-full border border-edge bg-surface px-4 py-2 text-sm outline-none transition focus:border-gold"
          >
            {SORTS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or artist"
            className="w-56 rounded-full border border-edge bg-surface px-4 py-2 text-sm outline-none transition focus:border-gold placeholder:text-neutral-600"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            title={v.hint}
            className={`rounded-full px-4 py-1.5 text-sm ${
              view === v.key
                ? "bg-gold text-bg font-semibold"
                : "border border-edge text-muted transition hover:border-gold/50 hover:text-white"
            }`}
          >
            {v.label}
            {counts && (
              <span className="ml-1.5 opacity-70">
                {v.key === "live"
                  ? counts.live
                  : v.key === "pulled"
                    ? counts.pulled
                    : v.key === "submitted"
                      ? counts.submitted
                      : counts.withCurators}
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-muted">
        {VIEWS.find((v) => v.key === view)?.hint} · Listen times are recorded from 3 August 2026
        onward, so swipes before then show none.
      </p>

      {flash && (
        <p className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {flash}{" "}
          <button onClick={() => setFlash(null)} className="underline underline-offset-2">
            dismiss
          </button>
        </p>
      )}

      {tracks === null ? (
        <p className="mt-4 text-sm text-muted">Loading...</p>
      ) : tracks.length === 0 ? (
        <p className="mt-4 rounded-xl border border-edge bg-surface p-6 text-center text-sm text-muted">
          {q ? `Nothing matching "${q}".` : "Nothing here."}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {tracks.slice(0, page.visible).map((t) => {
            // The gate runs on weighted votes, so progress has to be shown in
            // the same currency — otherwise a track reads as "40 of 75" while
            // the platform considers it 52.
            const votes = t.weightedTotalVotes;
            const rate = votes ? t.weightedRightVotes / votes : 0;
            const people = t.fanRightSwipes + t.fanLeftSwipes;
            return (
              <li
                key={t.id}
                className="rounded-xl border border-edge bg-surface p-3 md:flex md:flex-wrap md:items-center md:gap-3"
              >
                <div className="flex min-w-0 items-start gap-3 md:contents">
                <button
                  onClick={() => preview(t)}
                  title="Listen — check the audio is right before pulling it"
                  className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2"
                >
                  {t.artworkUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.artworkUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white">
                    {playing === t.id ? "❚❚" : "▶"}
                  </span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="flex flex-wrap items-center gap-2 truncate text-sm text-muted">
                    {t.artistName}
                    <span
                      title={
                        t.previewExpires
                          ? "Deezer links expire after about a day — worth replacing with an iTunes one"
                          : "iTunes links don't expire"
                      }
                      className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold ${
                        t.previewExpires
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          : "border-edge text-muted"
                      }`}
                    >
                      {t.previewSource}
                      {t.previewExpires && " · expires"}
                    </span>
                  </p>
                  <label className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <span className="sr-only">Genre for {t.title}</span>
                    <select
                      value={t.genre ?? ""}
                      disabled={busy === t.id}
                      onChange={(e) => setGenre(t, e.target.value)}
                      className="rounded-md border border-edge bg-bg px-2 py-1 text-xs outline-none transition focus:border-gold disabled:opacity-40"
                    >
                      <option value="" disabled>
                        no genre set
                      </option>
                      {GENRES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    {t.genre === null && <span className="text-nope">routes nowhere</span>}
                  </label>
                  <p className="mt-0.5 text-xs text-muted">
                    Added {new Date(t.addedAt).toLocaleDateString()} ·{" "}
                    {t.submittedBy ? (
                      <span className="text-gold">
                        Submitted by {t.submittedBy.name} ({t.submittedBy.email})
                      </span>
                    ) : (
                      "Catalogue — no artist attached, can never be sold on to curators"
                    )}
                  </p>
                </div>
                </div>

                {/* Full width and left-aligned on a phone; a right-hand
                    column only once the row is wide enough to hold one. */}
                <div className="mt-3 text-xs text-muted md:mt-0 md:shrink-0 md:text-right">
                  <p className="tabular-nums">
                    {votes === 0
                      ? "no votes yet"
                      : `${Math.round(rate * 100)}% of ${votes} vote${votes === 1 ? "" : "s"}`}
                  </p>
                  <p>
                    needs {Math.round(t.requiredApprovalRate * 100)}% of {t.requiredFanVotes}
                  </p>
                  {/* Only worth saying when the two differ — otherwise it's
                      noise on every row. */}
                  {votes > people && (
                    <p
                      className="text-gold/80"
                      title="Listeners who heard the full clip before deciding count twice"
                    >
                      from {people} listener{people === 1 ? "" : "s"}
                    </p>
                  )}

                  {/* What streaming numbers can't tell you: whether people
                      stayed. Says so explicitly when there's nothing yet,
                      rather than rendering blank and looking broken. */}
                  {t.avgListenMs !== null ? (
                    <>
                      <p className="text-gold">
                        {(t.avgListenMs / 1000).toFixed(1)}s average listen
                        <span className="text-muted"> of 30s</span>
                      </p>
                      {t.convictionRate !== null && t.fanRightSwipes > 0 && (
                        <p title="Share of likes that came after most of the clip had played">
                          {Math.round(t.convictionRate * 100)}% liked it after hearing it out
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted/70 italic">no listen data yet</p>
                  )}
                  {t.votesThisWeek > 0 && <p>{t.votesThisWeek} vote(s) this week</p>}
                  {t.curatorsAssigned > 0 && (
                    <p className="text-gold">with {t.curatorsAssigned} curators</p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0 md:contents">
                <button
                  onClick={() => {
                    setFixing(fixing === t.id ? null : t.id);
                    setLinkDraft("");
                  }}
                  className="shrink-0 rounded-full border border-edge px-3 py-1.5 text-xs text-muted transition hover:border-gold hover:text-gold"
                >
                  {fixing === t.id ? "Cancel" : "Fix track"}
                </button>

                {t.status === "REJECTED" ? (
                  <button
                    disabled={busy === t.id}
                    onClick={() => act(t, "RESTORE", "")}
                    className="shrink-0 rounded-full bg-hot px-4 py-1.5 text-sm font-bold text-bg disabled:opacity-40"
                  >
                    Put back
                  </button>
                ) : (
                  <button
                    disabled={busy === t.id}
                    onClick={() => setConfirming(t)}
                    className="shrink-0 rounded-full border border-nope/40 px-4 py-1.5 text-sm font-medium text-nope transition hover:bg-nope/10 disabled:opacity-40"
                  >
                    Pull
                  </button>
                )}
                </div>
                {fixing === t.id && (
                  <div className="w-full border-t border-edge pt-3">
                    <label className="block text-xs text-muted">
                      <strong className="text-white">Spotify link</strong> — fixes a track
                      matched to the wrong recording: re-reads title, artist, artwork and
                      audio, and refuses if it can&apos;t confirm they belong together.
                      <br />
                      <strong className="text-white">Apple Music or iTunes link</strong>, or a
                      direct audio link — replaces the audio only.
                      <br />
                      Whatever you paste is played before it&apos;s saved.
                      <input
                        value={linkDraft}
                        onChange={(e) => setLinkDraft(e.target.value)}
                        placeholder="Spotify, Apple Music or iTunes link"
                        className="mt-2 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm outline-none transition focus:border-gold placeholder:text-neutral-600"
                      />
                    </label>
                    <button
                      onClick={() => setPreview(t)}
                      disabled={busy === t.id || !linkDraft.trim()}
                      className="mt-2 rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-bg disabled:opacity-40"
                    >
                      {busy === t.id ? "Checking..." : "Use this audio"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {tracks && tracks.length > 0 && (
        <ShowMore
          shown={page.visible}
          total={tracks.length}
          onMore={page.more}
          onLess={page.reset}
        />
      )}

      {confirming && (
        <PullDialog
          track={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={(note) => act(confirming, "PULL", note)}
        />
      )}
    </AdminSection>
  );
}

function PullDialog({
  track,
  onCancel,
  onConfirm,
}: {
  track: Track;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-edge bg-surface p-6">
        <h3 className="text-lg font-semibold">Pull &ldquo;{track.title}&rdquo;?</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Fans stop being shown it immediately. Nothing is deleted — swipes, saves and any payment
          record stay intact, and you can put it back at any time.
        </p>

        {track.curatorsAssigned > 0 && (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            This track is already with {track.curatorsAssigned} curator(s). Pulling it here
            won&apos;t retract it from them — talk to them directly if it needs to come down.
          </p>
        )}

        {track.submittedBy && (
          <p className="mt-2 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-muted">
            An artist submitted this — {track.submittedBy.email}. Consider telling them why.
          </p>
        )}

        <label className="mt-4 block">
          <span className="text-sm font-semibold">Reason (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. audio is the wrong track"
            className="mt-2 w-full rounded-lg border border-edge bg-bg px-3 py-2.5 text-sm outline-none transition focus:border-gold placeholder:text-neutral-600"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full border border-edge px-5 py-2.5 text-sm font-semibold transition hover:text-white"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onConfirm(note);
            }}
            className="rounded-full bg-nope px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy ? "Pulling..." : "Pull from rotation"}
          </button>
        </div>
      </div>
    </div>
  );
}
