"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import { Bookmark, Cross, Disc, Pause, Play, Share } from "./icons";
import Equalizer from "./Equalizer";
import type { Fan } from "@/lib/types";
import { useRefreshOnReturn } from "@/lib/useRefreshOnReturn";
import { markSavesSeen } from "@/lib/savedCount";

type SavedTrack = {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  previewUrl: string;
  genre: string | null;
  status: string;
  fanRightSwipes: number;
  savedAt: string;
  savedToSpotifyAt: string | null;
  spotifyUrl: string;
};

export default function SavedList({ fan }: { fan: Fan }) {
  const [saved, setSaved] = useState<SavedTrack[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [shared, setShared] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/fans/saved?fanId=${fan.id}`)
      .then((r) => r.json())
      .then((d) => {
        const list = d.saved ?? [];
        setSaved(list);
        // Being on this screen is what clears the badge, and the length is
        // the real total, so it also corrects any drift from optimistic bumps.
        markSavesSeen(list.length);
      })
      .catch(() => {
        setSaved([]);
        // They came to look, so the badge clears even if the list did not load.
        markSavesSeen();
      });
  }, [fan.id]);

  useRefreshOnReturn(() => {
    fetch(`/api/fans/saved?fanId=${fan.id}`)
      .then((r) => r.json())
      .then((d) => {
        const list = d.saved ?? [];
        setSaved(list);
        markSavesSeen(list.length);
      })
      .catch(() => {});
  });

  /**
   * Takes a track off this list, or empties it.
   *
   * The swipe itself is kept server-side: the verdict is already counted on
   * the track and already reported to the artist. This is a library, and
   * clearing a library is not the same as changing your mind.
   */
  async function remove(trackId?: string) {
    const body = trackId ? { fanId: fan.id, trackId } : { fanId: fan.id, all: true };
    setRemoving(trackId ?? "all");
    // Stop any clip that is playing from outliving the row it belongs to.
    document.querySelectorAll("audio").forEach((a) => (a as HTMLAudioElement).pause());
    setPlaying(null);
    try {
      const res = await fetch("/api/fans/saved", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      setSaved((prev) => {
        const next = trackId ? (prev ?? []).filter((t) => t.id !== trackId) : [];
        markSavesSeen(next.length);
        return next;
      });
    } catch {
      // Offline or refused. The row stays, which is the honest outcome.
    } finally {
      setRemoving(null);
      setConfirmClear(false);
    }
  }

  function toggle(t: SavedTrack) {
    const el = document.getElementById(`a-${t.id}`) as HTMLAudioElement | null;
    if (!el) return;
    if (playing === t.id) {
      el.pause();
      setPlaying(null);
      return;
    }
    document.querySelectorAll("audio").forEach((a) => (a as HTMLAudioElement).pause());
    el.play().catch(() => {});
    setPlaying(t.id);
  }

  return (
    <MotrShell>
      <div className="w-full max-w-sm md:max-w-2xl">
        <h1 className="font-display text-3xl uppercase tracking-wide">Saved</h1>
        <p className="text-muted mt-1 text-sm">
          Tracks you backed, and now you can see who made them. Tap the Spotify icon to open
          one there and save it.
        </p>

        {saved === null ? (
          <div className="mt-10 flex justify-center">
            <Equalizer className="text-gold/30 h-8 w-8 " />
          </div>
        ) : saved.length === 0 ? (
          <div className="mt-14 flex flex-col items-center gap-3 text-center">
            <Bookmark className="text-gold/40 h-10 w-10" />
            <p className="font-display text-xl uppercase tracking-wide">Nothing saved yet</p>
            <p className="text-muted max-w-xs text-sm">
              Swipe right on something you like and it&apos;ll show up here, with the artist
              named.
            </p>
            <Link
              href="/"
              className="border-gold/50 text-gold mt-2 rounded-full border px-5 py-2 text-sm font-semibold"
            >
              Start discovering
            </Link>
          </div>
        ) : (
          <>
          <div className="mt-6 flex justify-end">
            {confirmClear ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-muted">Remove all {saved.length}?</span>
                <button
                  onClick={() => remove()}
                  disabled={removing !== null}
                  className="border-nope text-nope hover:bg-nope/10 rounded-full border px-3 py-1 font-semibold transition disabled:opacity-40"
                >
                  {removing === "all" ? "Removing" : "Yes, clear"}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="border-edge text-muted hover:text-ink rounded-full border px-3 py-1 transition"
                >
                  Keep them
                </button>
              </span>
            ) : (
              /* Two steps rather than one. Emptying a list someone spent
                 weeks building should not be a single stray tap. */
              <button
                onClick={() => setConfirmClear(true)}
                className="text-muted hover:text-nope text-xs underline underline-offset-4 transition"
              >
                Clear list
              </button>
            )}
          </div>

          <ul className="mt-3 space-y-3">
            {saved.map((t) => {
              // REJECTED is not DISCOVERY either, so the old check crowned a
              // pulled track as "Broke through" — the opposite of the truth.
              // Some were pulled precisely because they played the wrong
              // recording, so they aren't offered for playback at all.
              const brokeThrough = t.status === "VETTING" || t.status === "GRADUATED";
              const removed = t.status === "REJECTED";
              return (
              <li
                key={t.id}
                className={`border-edge bg-surface flex items-center gap-3 rounded-2xl border p-3 ${
                  removed ? "opacity-60" : ""
                }`}
              >
                <button
                  onClick={() => !removed && toggle(t)}
                  disabled={removed}
                  aria-label={playing === t.id ? `Pause ${t.title}` : `Play ${t.title}`}
                  className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl"
                >
                  {t.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.artworkUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="bg-surface-2 flex h-full w-full items-center justify-center">
                      <Disc className="text-gold/30 h-6 w-6" />
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-ink">
                    {playing === t.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.title}</p>
                  <p className="text-gold truncate text-sm">{t.artistName}</p>
                  {/* Numeric and short on purpose: it sits under two lines
                      that matter more, and a listener scanning for when they
                      found something wants a date, not a sentence. */}
                  <p className="text-muted mt-0.5 text-xs tabular-nums">
                    {new Date(t.savedAt).toLocaleDateString("en-US", {
                      month: "2-digit",
                      day: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                  {brokeThrough && (
                    <span className="text-hot mt-1 inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-widest">
                      <Disc className="h-2.5 w-2.5" /> Broke through
                    </span>
                  )}
                  {removed && (
                    <span className="text-muted mt-1 block text-[0.65rem] uppercase tracking-widest">
                      No longer on MOTR
                    </span>
                  )}
                </div>

                {/* A link rather than an API call: Spotify's API allows
                    five users per app unless you have 250k+ monthly actives,
                    so the button could never have worked for most fans. This
                    opens the Spotify app straight at the track. */}
                {/* Sharing a find is the only way a listener brings anyone
                    in, and the link opens the app on this exact song rather
                    than on a random one. Uses the phone's own share sheet
                    where there is one, and falls back to the clipboard. */}
                <button
                  onClick={async () => {
                    const url = `https://app.musicontherox.com/?track=${t.id}`;
                    const text = `Found this on MOTR: "${t.title}" by ${t.artistName}. Give it 30 seconds.`;
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: t.title, text, url });
                        return;
                      }
                      await navigator.clipboard?.writeText(`${text} ${url}`);
                      setShared(t.id);
                      window.setTimeout(() => setShared(null), 1800);
                    } catch {
                      // Cancelling the share sheet lands here too, which is
                      // not a failure and must not look like one.
                    }
                  }}
                  aria-label={`Share ${t.title}`}
                  title="Share this find"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                    shared === t.id
                      ? "border-gold text-gold"
                      : "border-edge text-muted hover:border-gold hover:text-gold"
                  }`}
                >
                  <Share className="h-4 w-4" />
                </button>

                {/* Removes it from this list only. The swipe stays counted,
                    so the artist does not lose a save because someone tidied
                    up months later. */}
                <button
                  onClick={() => remove(t.id)}
                  disabled={removing !== null}
                  aria-label={`Remove ${t.title} from your saved list`}
                  title="Remove from your list"
                  className="border-edge text-muted hover:border-nope hover:text-nope flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40"
                >
                  <Cross className="h-3.5 w-3.5" />
                </button>

                <a
                  href={t.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${t.title} in Spotify`}
                  title="Open in Spotify to save it"
                  className="border-edge text-hot hover:border-hot flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition"
                >
                  <SpotifyMark className="h-4 w-4" />
                </a>

                <audio
                  id={`a-${t.id}`}
                  src={t.previewUrl}
                  onEnded={() => setPlaying(null)}
                  className="hidden"
                />
              </li>
              );
            })}
          </ul>
          </>
        )}
      </div>
    </MotrShell>
  );
}

function SpotifyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.8.8 0 0 1-1.1.3c-3-1.9-6.8-2.3-11.3-1.3a.8.8 0 1 1-.3-1.5c4.9-1.1 9.1-.6 12.4 1.4.4.2.5.7.3 1.1Zm1.2-2.8a1 1 0 0 1-1.3.3c-3.4-2.1-8.6-2.7-12.6-1.5a1 1 0 0 1-.6-1.9c4.6-1.4 10.3-.7 14.2 1.7.5.3.6.9.3 1.4Zm.1-2.9C14 8.4 7.7 8.2 4.2 9.2a1.2 1.2 0 1 1-.7-2.3C7.6 5.7 14.5 6 19 8.6a1.2 1.2 0 0 1-1.2 2.1Z" />
    </svg>
  );
}
