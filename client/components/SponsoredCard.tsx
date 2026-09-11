"use client";

import { useEffect, useRef, useState } from "react";
import { Cross } from "./icons";

const SWIPE_THRESHOLD = 100;
const EXIT_DISTANCE = 600;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * An ad in the swipe rotation, shaped like a card.
 *
 * Swiping either way dismisses it and nothing is recorded — there is no vote
 * to cast on an advert. Visiting the advertiser means tapping the ad itself,
 * which is a real click inside Google's frame.
 *
 * That distinction is not a design preference. An AdSense ad renders in a
 * cross-origin iframe: the destination URL is never exposed to this page, so
 * "swipe right to open the ad" cannot be implemented even in principle, and
 * synthesising a click from a gesture is invalid traffic — the fastest way to
 * have a publisher account terminated. So the gesture dismisses, and only a
 * deliberate tap on the ad counts.
 *
 * Because the ad is an iframe, pointer events over it belong to Google, not
 * to us. The drag handles live on the frame around it, and a Skip button is
 * always present so there is a way past that doesn't depend on finding the
 * border.
 */
export default function SponsoredCard({
  client,
  slot,
  onDismiss,
}: {
  client: string;
  slot: string;
  onDismiss: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const pushed = useRef(false);

  useEffect(() => {
    // Strict mode mounts twice in development; pushing the same slot twice
    // makes AdSense log "already have ads in them" and render nothing.
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // A blocked or failed ad must never break the feed. The card still
      // shows its frame and its Skip button, and the listener moves on.
    }
  }, []);

  function commit() {
    setDx(dx > 0 ? EXIT_DISTANCE : -EXIT_DISTANCE);
    setTimeout(onDismiss, 180);
  }

  function onPointerDown(e: React.PointerEvent) {
    setDragging(true);
    dragStartX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDx(e.clientX - dragStartX.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dx) > SWIPE_THRESHOLD) commit();
    else setDx(0);
  }

  const rotation = dx / 22;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col select-none md:max-w-2xl md:justify-center">
      <div className="relative flex min-h-0 flex-1 flex-col md:max-h-[26rem] md:flex-none">
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
          {/* Labelled, and not subtly. An ad a listener mistakes for a track
              is the thing that gets a publisher account reviewed, and it is
              also just dishonest. */}
          <div className="border-edge flex shrink-0 items-center justify-between border-b px-4 py-2.5">
            <span className="motr-label text-muted">Sponsored</span>
            <button
              onClick={onDismiss}
              aria-label="Skip this ad"
              className="text-muted hover:text-white flex items-center gap-1.5 text-xs font-semibold transition"
            >
              Skip
              <Cross className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* The ad itself. Padding on all sides is deliberate: it gives the
              drag gesture somewhere to land that isn't Google's iframe. */}
          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            <ins
              className="adsbygoogle"
              style={{ display: "block", width: "100%", height: "100%", minHeight: 250 }}
              data-ad-client={client}
              data-ad-slot={slot}
              data-ad-format="rectangle"
              data-full-width-responsive="false"
            />
          </div>

          <p className="text-muted/70 shrink-0 px-4 pb-3 text-center text-[0.65rem] leading-relaxed">
            Ads keep MOTR free. Swipe either way to carry on, or tap the ad if it interests you.
          </p>
        </div>
      </div>

      {/* Matches the height the Nope/Like row occupies on a track card, so the
          feed doesn't jump when an ad comes up. */}
      <div className="mt-3 flex shrink-0 justify-center">
        <button
          onClick={onDismiss}
          className="border-edge hover:border-gold hover:text-gold rounded-full border px-8 py-3 text-sm font-semibold transition"
        >
          Keep swiping
        </button>
      </div>
    </div>
  );
}
