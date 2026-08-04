"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { Cross, Crown, Heart, Pause, Play } from "./icons";

const SWIPE_THRESHOLD = 100;
const EXIT_DISTANCE = 600;

/** Every track is a 30-second clip, no matter how long the source file is. */
const CLIP_SECONDS = 30;

export default function SwipeCard({
  track,
  onSwipe,
  disabled,
  onProgress,
}: {
  track: Track;
  onSwipe: (direction: "LEFT" | "RIGHT", listenDurationMs: number) => void;
  disabled: boolean;
  /** Lets the shell render the clip scrubber above the card. */
  onProgress?: (currentTime: number, duration: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<"LEFT" | "RIGHT" | null>(null);
  const dragStartX = useRef(0);

  useEffect(() => {
    audioRef.current
      ?.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, []);

  useEffect(() => {
    if (disabled) return;
    function onKey(e: KeyboardEvent) {
      // Don't hijack keys meant for whatever the user is actually focused on.
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName)) return;

      if (e.key === "ArrowLeft") commitSwipe("LEFT");
      if (e.key === "ArrowRight") commitSwipe("RIGHT");
      if (e.key === " " || e.code === "Space") {
        e.preventDefault(); // otherwise the page scrolls
        togglePlay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, currentTime]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
    } else {
      // Replaying after the clip ran out restarts it.
      if (a.currentTime >= CLIP_SECONDS) a.currentTime = 0;
      a.play().catch(() => {});
    }
  }

  function commitSwipe(direction: "LEFT" | "RIGHT") {
    if (exiting || disabled) return;
    setExiting(direction);
    setDx(direction === "RIGHT" ? EXIT_DISTANCE : -EXIT_DISTANCE);
    const listenDurationMs = Math.round(currentTime * 1000);
    setTimeout(() => onSwipe(direction, listenDurationMs), 180);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || exiting) return;
    setDragging(true);
    dragStartX.current = e.clientX - dx;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDx(e.clientX - dragStartX.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dx > SWIPE_THRESHOLD) commitSwipe("RIGHT");
    else if (dx < -SWIPE_THRESHOLD) commitSwipe("LEFT");
    else setDx(0);
  }

  const rotation = dx / 22;
  const yes = Math.min(Math.max(dx / SWIPE_THRESHOLD, 0), 1);
  const nope = Math.min(Math.max(-dx / SWIPE_THRESHOLD, 0), 1);
  const played = duration ? currentTime / duration : 0;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col select-none md:max-w-2xl md:justify-center">
      {/* The stack layers live in their own positioning context so they can't
          spill over the action buttons below. */}
      <div className="relative flex min-h-0 flex-1 flex-col md:max-h-[26rem] md:flex-none">
        <div className="bg-surface/40 absolute inset-x-6 -bottom-2 top-5 -rotate-2 rounded-[28px]" />
        <div className="bg-surface/70 absolute inset-x-3 -bottom-1 top-2.5 rotate-1 rounded-[28px]" />

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${dx}px) rotate(${rotation}deg)`,
          transition: dragging ? "none" : "transform 180ms ease-out",
          touchAction: "pan-y",
        }}
        className="border-edge bg-surface relative flex min-h-0 flex-1 cursor-grab flex-col overflow-hidden rounded-[28px] border shadow-2xl active:cursor-grabbing"
      >
        <div
          className="text-hot border-hot pointer-events-none absolute left-5 top-5 z-10 -rotate-12 rounded-xl border-4 px-3 py-1 text-2xl font-black"
          style={{ opacity: yes }}
        >
          LIKE
        </div>
        <div
          className="text-nope border-nope pointer-events-none absolute right-5 top-5 z-10 rotate-12 rounded-xl border-4 px-3 py-1 text-2xl font-black"
          style={{ opacity: nope }}
        >
          NOPE
        </div>

        {/* Stacked on a phone; side-by-side on a wider screen, where a tall
            single column would leave the artwork tiny and the sides empty. */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row md:items-stretch">
        <div className="bg-bg relative flex min-h-0 flex-1 justify-center md:w-1/2 md:flex-none">
          {track.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.artworkUrl}
              alt=""
              // Equal h/w in viewport units keeps it square and bounded
              // without needing an intrinsic size to resolve against.
              className="h-full max-h-full w-auto max-w-full object-contain md:h-full md:w-full md:object-cover"
              draggable={false}
            />
          ) : (
            <div className="from-surface-2 to-bg flex aspect-square h-full max-w-full items-center justify-center bg-gradient-to-br md:aspect-auto md:h-full md:w-full">
              <Crown className="text-gold/25 h-16 w-16" />
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 pb-3 pt-2 md:flex md:flex-1 md:flex-col md:justify-center md:px-7">
          <h2 className="truncate text-xl font-bold md:text-2xl">{track.title}</h2>
          <p className="text-gold mt-0.5 truncate text-sm font-semibold">{track.artistName}</p>

          {track.genre && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="border-gold/50 text-gold rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium">
                {track.genre}
              </span>
            </div>
          )}

          <audio
            ref={audioRef}
            src={track.previewUrl}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              // Source files can be full-length; the product is a 30s clip.
              if (el.currentTime >= CLIP_SECONDS) {
                el.pause();
                el.currentTime = CLIP_SECONDS;
                setCurrentTime(CLIP_SECONDS);
                onProgress?.(CLIP_SECONDS, CLIP_SECONDS);
                return;
              }
              setCurrentTime(el.currentTime);
              onProgress?.(el.currentTime, CLIP_SECONDS);
            }}
            onLoadedMetadata={(e) =>
              setDuration(Math.min(e.currentTarget.duration || CLIP_SECONDS, CLIP_SECONDS))
            }
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Play control with the gold progress ring from the comp. */}
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="relative flex h-16 w-16 items-center justify-center"
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                <circle cx="50" cy="50" r="46" fill="none" stroke="#2a2a2a" strokeWidth="4" />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="var(--motr-gold)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 46}
                  strokeDashoffset={2 * Math.PI * 46 * (1 - played)}
                />
              </svg>
              <span className="flex flex-col items-center leading-none">
                {isPlaying ? <Pause /> : <Play />}
                <span className="text-muted mt-1.5 text-[11px] tabular-nums">
                  {fmt(currentTime)}
                </span>
              </span>
            </button>
          </div>
        </div>
        </div>
      </div>

      </div>

      {/* Tap targets, so swiping is optional rather than required. Labelled
          left/right to match the gesture they stand in for. */}
      <div className="relative z-10 mt-3 flex shrink-0 items-center justify-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => commitSwipe("LEFT")}
          className="border-nope/30 bg-surface-2 text-nope hover:border-nope group flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 transition disabled:opacity-40"
        >
          <Cross className="h-5 w-5" />
          <span className="text-left leading-tight">
            <span className="motr-verdict block text-lg">Nope</span>
            <span className="text-muted block text-[0.6rem] uppercase tracking-widest">
              Not for me
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => commitSwipe("RIGHT")}
          className="border-hot/30 bg-surface-2 text-hot hover:border-hot group flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 transition disabled:opacity-40"
        >
          <span className="text-right leading-tight">
            <span className="motr-verdict block text-lg">Like</span>
            <span className="text-muted block text-[0.6rem] uppercase tracking-widest">
              Save song
            </span>
          </span>
          <Heart className="h-5 w-5" />
        </button>
      </div>

      <p className="motr-label mt-1.5 flex shrink-0 items-center justify-center gap-2 text-[0.55rem]">
        <Crown className="text-gold h-3 w-3" />
        <span className="md:hidden">Tap or swipe to decide</span>
        <span className="hidden md:inline">
          ← Nope · → Like · Space to play — or drag the card
        </span>
        <Crown className="text-gold h-3 w-3" />
      </p>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
