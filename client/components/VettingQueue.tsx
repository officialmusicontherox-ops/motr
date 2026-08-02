"use client";

import { useEffect, useState } from "react";
import SwipeCard from "./SwipeCard";
import type { Track, User } from "@/lib/types";

async function fetchNextTrack(userId: string): Promise<Track | null> {
  const res = await fetch(`/api/vet/next?userId=${userId}`);
  const data = await res.json();
  return data.track;
}

export default function VettingQueue({ curator }: { curator: User }) {
  const [track, setTrack] = useState<Track | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    fetchNextTrack(curator.id).then((next) => {
      if (!ignore) setTrack(next);
    });
    return () => {
      ignore = true;
    };
  }, [curator.id, refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSwipe(direction: "LEFT" | "RIGHT", listenDurationMs: number) {
    if (!track) return;
    setPending(true);
    const res = await fetch("/api/vet/swipe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: curator.id, trackId: track.id, direction, listenDurationMs }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.justGraduated) {
        setToast(`🎉 "${track.title}" just graduated to the public charts!`);
      }
    }
    setTrack(undefined);
    setRefreshKey((k) => k + 1);
    setPending(false);
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-8 p-8">
      <div className="flex w-full max-w-sm items-center justify-between text-sm text-zinc-500">
        <span>
          Vetting as <strong className="text-zinc-800 dark:text-zinc-200">{curator.username}</strong>
        </span>
        <span>weight {curator.curationWeight.toFixed(1)}</span>
      </div>

      {toast && (
        <div className="fixed top-6 rounded-full bg-emerald-500 px-5 py-2 text-white shadow-lg">
          {toast}
        </div>
      )}

      {track === undefined && <p className="text-zinc-500">Loading next track...</p>}

      {track === null && (
        <div className="flex flex-col items-center gap-2 text-center text-zinc-500">
          <p className="text-lg">You&apos;re all caught up.</p>
          <p>No new tracks in the vetting queue right now — check back soon.</p>
        </div>
      )}

      {track && (
        <SwipeCard key={track.id} track={track} onSwipe={handleSwipe} disabled={pending} />
      )}
    </div>
  );
}
