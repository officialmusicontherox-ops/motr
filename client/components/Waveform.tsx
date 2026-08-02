"use client";

import { useEffect, useState } from "react";
import { decodePeaks, fallbackPeaks, BAR_COUNT } from "@/lib/waveformPeaks";

export default function Waveform({
  trackId,
  previewUrl,
  progress,
  onSeek,
}: {
  trackId: string;
  previewUrl: string;
  progress: number;
  onSeek: (fraction: number) => void;
}) {
  const [peaks, setPeaks] = useState<number[]>(() => fallbackPeaks(trackId));

  useEffect(() => {
    let cancelled = false;
    decodePeaks(previewUrl)
      .then((real) => {
        if (!cancelled) setPeaks(real);
      })
      .catch(() => {
        // Preview host didn't allow us to read the audio bytes — keep
        // the deterministic fallback shape, playback is unaffected.
      });
    return () => {
      cancelled = true;
    };
  }, [previewUrl, trackId]);

  return (
    <div
      className="flex h-16 w-full cursor-pointer items-center gap-[2px]"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek((e.clientX - rect.left) / rect.width);
      }}
    >
      {peaks.map((peak, i) => {
        const played = i / BAR_COUNT < progress;
        return (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors ${
              played ? "bg-emerald-400" : "bg-zinc-300 dark:bg-zinc-700"
            }`}
            style={{ height: `${Math.round(peak * 100)}%` }}
          />
        );
      })}
    </div>
  );
}
