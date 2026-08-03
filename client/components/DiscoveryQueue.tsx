"use client";

import { useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import SwipeCard from "./SwipeCard";
import GenrePicker from "./GenrePicker";
import { Crown } from "./icons";
import type { Fan, Track } from "@/lib/types";

const GENRE_KEY = "motr:genre";

type FeedResponse = {
  track: Track | null;
  genreExhausted?: boolean;
  othersAvailable?: number;
};

async function fetchNextTrack(fanId: string, genre: string | null): Promise<FeedResponse> {
  const q = new URLSearchParams({ fanId });
  if (genre) q.set("genre", genre);
  const res = await fetch(`/api/discover/next?${q}`);
  return res.json();
}

export default function DiscoveryQueue({ fan }: { fan: Fan }) {
  const [track, setTrack] = useState<Track | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [breakout, setBreakout] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clip, setClip] = useState({ currentTime: 0, duration: 30 });
  // Chosen mood, remembered between visits — someone who filtered to Jazz
  // last night probably still wants Jazz, but can switch in one tap.
  const [genre, setGenre] = useState<string | null>(null);
  const [genreCounts, setGenreCounts] = useState<Record<string, number>>();
  const [exhausted, setExhausted] = useState<{ othersAvailable: number } | null>(null);

  useEffect(() => {
    setGenre(localStorage.getItem(GENRE_KEY));
  }, []);

  function chooseGenre(next: string | null) {
    setGenre(next);
    if (next) localStorage.setItem(GENRE_KEY, next);
    else localStorage.removeItem(GENRE_KEY);
    setTrack(undefined);
    setExhausted(null);
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    let ignore = false;
    setClip({ currentTime: 0, duration: 30 });
    fetchNextTrack(fan.id, genre).then((res) => {
      if (ignore) return;
      setTrack(res.track);
      setExhausted(
        res.genreExhausted ? { othersAvailable: res.othersAvailable ?? 0 } : null
      );
    });
    return () => {
      ignore = true;
    };
  }, [fan.id, refreshKey, genre]);

  // Refreshed alongside the feed so the per-genre counts stay honest as the
  // fan swipes through them.
  useEffect(() => {
    fetch(`/api/discover/genres?fanId=${fan.id}`)
      .then((r) => r.json())
      .then((d) => setGenreCounts(d.counts))
      .catch(() => {});
  }, [fan.id, refreshKey]);

  useEffect(() => {
    if (!breakout) return;
    const t = setTimeout(() => setBreakout(null), 4000);
    return () => clearTimeout(t);
  }, [breakout]);

  async function handleSwipe(direction: "LEFT" | "RIGHT") {
    if (!track) return;
    setPending(true);

    const res = await fetch("/api/discover/swipe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fanId: fan.id, trackId: track.id, direction }),
    });

    if (res.ok) {
      const data = await res.json();
      if (direction === "RIGHT") setSavedCount((c) => c + 1);
      if (data.feeNowRequested) setBreakout(track.title);
    }

    setTrack(undefined);
    setRefreshKey((k) => k + 1);
    setPending(false);
  }

  return (
    <MotrShell clip={track ? clip : null}>
      <div className="w-full max-w-sm md:max-w-2xl">
        <GenrePicker value={genre} onChange={chooseGenre} counts={genreCounts} />
      </div>

      <div className="mb-5 flex w-full max-w-sm items-center justify-between md:max-w-2xl">
        <span className="motr-label">
          <span className="text-white">{fan.username}</span>
        </span>
        <span className="motr-label flex items-center gap-1.5">
          <Crown className="text-gold h-3 w-3" />
          <span className="text-gold">{savedCount}</span> saved
        </span>
      </div>

      {/* A track clearing the fan vote is the whole point of the app —
          give it a moment rather than a quiet toast. */}
      {breakout && (
        <div className="fixed inset-x-0 top-0 z-30 flex justify-center px-5 pt-4">
          <div className="border-gold/40 bg-surface flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl">
            <Crown className="text-gold h-6 w-6 shrink-0" />
            <p className="text-sm">
              <span className="text-gold font-semibold">{breakout}</span> broke through — it&apos;s
              going to curators.
            </p>
          </div>
        </div>
      )}

      {track === undefined && (
        <div className="flex flex-1 items-center justify-center">
          <Crown className="text-gold/30 h-10 w-10 animate-pulse" />
        </div>
      )}

      {track === null && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Crown className="text-gold/40 h-12 w-12" />
          <p className="font-display text-2xl uppercase tracking-wide">
            {exhausted ? `That's all the ${genre?.split(" / ")[0]}` : "You're all caught up"}
          </p>
          <p className="text-muted max-w-xs text-sm">
            {exhausted && exhausted.othersAvailable > 0
              ? `You've heard every ${genre?.split(" / ")[0]} track we have. There are ${exhausted.othersAvailable} more waiting in other genres.`
              : "You've heard everything in the queue. New tracks land here constantly — come back soon."}
          </p>
          {exhausted && exhausted.othersAvailable > 0 && (
            <button
              onClick={() => chooseGenre(null)}
              className="bg-gold text-bg mt-1 rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wide"
            >
              Play everything
            </button>
          )}
          {savedCount > 0 && (
            <a
              href="/saved"
              className="border-gold/50 text-gold mt-2 rounded-full border px-5 py-2 text-sm font-semibold"
            >
              See your {savedCount} saved
            </a>
          )}
        </div>
      )}

      {track && (
        <SwipeCard
          key={track.id}
          track={track}
          disabled={pending}
          onSwipe={(direction) => handleSwipe(direction)}
          onProgress={(currentTime, duration) => setClip({ currentTime, duration })}
        />
      )}
    </MotrShell>
  );
}
