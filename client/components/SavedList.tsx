"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import { Bookmark, Crown, Pause, Play } from "./icons";
import type { Fan } from "@/lib/types";
import { useRefreshOnReturn } from "@/lib/useRefreshOnReturn";

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

  useEffect(() => {
    fetch(`/api/fans/saved?fanId=${fan.id}`)
      .then((r) => r.json())
      .then((d) => setSaved(d.saved ?? []))
      .catch(() => setSaved([]));
  }, [fan.id]);

  useRefreshOnReturn(() => {
    fetch(`/api/fans/saved?fanId=${fan.id}`)
      .then((r) => r.json())
      .then((d) => setSaved(d.saved ?? []))
      .catch(() => {});
  });

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
          Tracks you backed. Tap the Spotify icon to open one there and save it.
        </p>

        {saved === null ? (
          <div className="mt-10 flex justify-center">
            <Crown className="text-gold/30 h-8 w-8 animate-pulse" />
          </div>
        ) : saved.length === 0 ? (
          <div className="mt-14 flex flex-col items-center gap-3 text-center">
            <Bookmark className="text-gold/40 h-10 w-10" />
            <p className="font-display text-xl uppercase tracking-wide">Nothing saved yet</p>
            <p className="text-muted max-w-xs text-sm">
              Swipe right on something you like and it&apos;ll show up here.
            </p>
            <Link
              href="/"
              className="border-gold/50 text-gold mt-2 rounded-full border px-5 py-2 text-sm font-semibold"
            >
              Start discovering
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
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
                      <Crown className="text-gold/30 h-6 w-6" />
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                    {playing === t.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.title}</p>
                  <p className="text-gold truncate text-sm">{t.artistName}</p>
                  {brokeThrough && (
                    <span className="text-hot mt-1 inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-widest">
                      <Crown className="h-2.5 w-2.5" /> Broke through
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
