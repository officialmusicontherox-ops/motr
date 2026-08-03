"use client";

import { useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import { Bookmark, Check, Crown, Pause, Play, Plus } from "./icons";
import type { Fan } from "@/lib/types";

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
};

export default function SavedList({ fan }: { fan: Fan }) {
  const [saved, setSaved] = useState<SavedTrack[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; reconnect: boolean } | null>(null);

  async function addToSpotify(t: SavedTrack) {
    setBusyId(t.id);
    setNotice(null);
    const res = await fetch("/api/fans/save-to-spotify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fanId: fan.id, trackId: t.id }),
    });
    setBusyId(null);

    if (res.ok) {
      setSaved((prev) =>
        prev?.map((x) =>
          x.id === t.id ? { ...x, savedToSpotifyAt: new Date().toISOString() } : x
        ) ?? prev
      );
      return;
    }

    const data = await res.json().catch(() => ({}));
    setNotice({
      text: data.error ?? "Couldn't add that to Spotify.",
      reconnect: data.code === "not_connected" || data.code === "needs_reconnect",
    });
  }

  useEffect(() => {
    fetch(`/api/fans/saved?fanId=${fan.id}`)
      .then((r) => r.json())
      .then((d) => setSaved(d.saved ?? []))
      .catch(() => setSaved([]));
  }, [fan.id]);

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
          Tracks you backed. Tap <span className="text-gold">+</span> to add one to your Spotify
          library.
        </p>

        {notice && (
          <div className="border-edge bg-surface mt-4 rounded-xl border p-3 text-sm">
            <p className="text-muted">{notice.text}</p>
            {notice.reconnect && (
              <a
                href={`/api/auth/spotify/login?link=${fan.id}`}
                className="bg-hot text-bg mt-2 inline-block rounded-full px-4 py-1.5 text-xs font-bold"
              >
                Connect Spotify
              </a>
            )}
          </div>
        )}

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
            <a
              href="/"
              className="border-gold/50 text-gold mt-2 rounded-full border px-5 py-2 text-sm font-semibold"
            >
              Start discovering
            </a>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {saved.map((t) => (
              <li
                key={t.id}
                className="border-edge bg-surface flex items-center gap-3 rounded-2xl border p-3"
              >
                <button
                  onClick={() => toggle(t)}
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
                  {t.status !== "DISCOVERY" && (
                    <span className="text-hot mt-1 inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-widest">
                      <Crown className="h-2.5 w-2.5" /> Broke through
                    </span>
                  )}
                </div>

                {/* Push the save into the fan's own Spotify library — the
                    reason fans have accounts at all. */}
                {t.savedToSpotifyAt ? (
                  <span
                    title="In your Spotify library"
                    className="text-hot flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  >
                    <Check className="h-5 w-5" />
                  </span>
                ) : (
                  <button
                    onClick={() => addToSpotify(t)}
                    disabled={busyId === t.id}
                    aria-label={`Add ${t.title} to Spotify`}
                    title="Add to your Spotify library"
                    className="border-edge text-gold hover:border-gold flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40"
                  >
                    {busyId === t.id ? (
                      <Crown className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Plus className="h-5 w-5" />
                    )}
                  </button>
                )}

                <audio
                  id={`a-${t.id}`}
                  src={t.previewUrl}
                  onEnded={() => setPlaying(null)}
                  className="hidden"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </MotrShell>
  );
}
