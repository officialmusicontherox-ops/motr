"use client";

import { useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import SwipeCard from "./SwipeCard";
import { Crown } from "./icons";
import type { Fan, Track } from "@/lib/types";

async function fetchNextTrack(fanId: string): Promise<Track | null> {
  const res = await fetch(`/api/discover/next?fanId=${fanId}`);
  return (await res.json()).track;
}

export default function DiscoveryQueue({ fan }: { fan: Fan }) {
  const [track, setTrack] = useState<Track | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [breakout, setBreakout] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clip, setClip] = useState({ currentTime: 0, duration: 30 });

  useEffect(() => {
    let ignore = false;
    setClip({ currentTime: 0, duration: 30 });
    fetchNextTrack(fan.id).then((next) => {
      if (!ignore) setTrack(next);
    });
    return () => {
      ignore = true;
    };
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
          <p className="font-display text-2xl uppercase tracking-wide">You&apos;re all caught up</p>
          <p className="text-muted max-w-xs text-sm">
            You&apos;ve heard everything in the queue. New tracks land here constantly — come back
            soon.
          </p>
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
