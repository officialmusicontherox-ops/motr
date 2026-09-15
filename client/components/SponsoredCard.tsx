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
 * The gesture problem, stated plainly: an AdSense ad renders in a
 * cross-origin iframe, so a touch that lands on the ad belongs to Google and
 * never reaches this component. There is no way to swipe a card away by
 * dragging the advert itself, on any site, by any means.
 *
 * The first version filled the card with the ad and left only a hairline of
 * frame to drag, which meant a listener mid-swipe hit a card that simply
 * refused to move. So the ad is now a fixed block with real margin around it:
 * everything outside that block drags normally, and the controls underneath
 * are the same shape and in the same place as the Nope/Like buttons on a
 * track card, so the habit already formed still works.
 *
 * Tapping the ad is a genuine click inside Google's frame, which is the only
 * kind that may be counted. Synthesising one from a gesture would be invalid
 * traffic and is the fastest way to lose a publisher account.
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
      // A blocked or failed ad must never break the feed. The card keeps its
      // frame and its controls, and the listener moves on.
    }
  }, []);

  function leave(direction: -1 | 1) {
    setDx(direction * EXIT_DISTANCE);
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
    if (Math.abs(dx) > SWIPE_THRESHOLD) leave(dx > 0 ? 1 : -1);
    else setDx(0);
  }

  const rotation = dx / 22;
  const drift = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);

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
          <div className="border-edge flex shrink-0 items-center justify-between border-b px-4 py-2.5">
            <span className="motr-label text-muted">Sponsored</span>
            <button
              onClick={onDismiss}
              aria-label="Skip this ad"
              className="text-muted hover:text-ink flex items-center gap-1.5 text-xs font-semibold transition"
            >
              Skip
              <Cross className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* The ad is a fixed block, not a filler. The padding around it is
              the part a finger can actually drag, so it has to be wide enough
              to hit without aiming — and now says so. */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-8 py-5">
            {/* Only on ad cards. A track card needs no instructions because
                the whole thing drags; this one has a dead centre, so the
                live edges have to be visible. They brighten as the card
                moves, which confirms the drag is working the moment it
                starts. */}
            <SwipeRail side="left" active={drift} />
            <SwipeRail side="right" active={drift} />

            <ins
              className="adsbygoogle"
              style={{
                display: "block",
                width: 300,
                height: 250,
                maxWidth: "100%",
              }}
              data-ad-client={client}
              data-ad-slot={slot}
              data-ad-format="rectangle"
              data-full-width-responsive="false"
            />
          </div>

          <p
            className="text-muted/70 shrink-0 px-4 pb-3 text-center text-[0.65rem] leading-relaxed transition-opacity"
            style={{ opacity: 1 - drift }}
          >
            Swipe from either edge, or use the buttons below. Tap the ad only if it interests you.
          </p>
        </div>
      </div>

      {/* Same shape, same place, same size as the Nope/Like row on a track
          card. Someone who has swiped ten tracks already knows where these
          are, which matters more here than anywhere else because the card
          itself can't be dragged across its middle. */}
      <div className="relative z-10 mt-3 flex shrink-0 items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => leave(-1)}
          className="border-edge bg-surface-2 text-muted hover:border-gold hover:text-gold flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 transition"
        >
          <Cross className="h-5 w-5" />
          <span className="text-left leading-tight">
            <span className="motr-verdict block text-lg">Skip</span>
            <span className="text-muted block text-[0.6rem] uppercase tracking-widest">
              Back to music
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => leave(1)}
          className="border-edge bg-surface-2 text-muted hover:border-gold hover:text-gold flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 transition"
        >
          <span className="text-right leading-tight">
            <span className="motr-verdict block text-lg">Next</span>
            <span className="text-muted block text-[0.6rem] uppercase tracking-widest">
              Keep swiping
            </span>
          </span>
          <Cross className="h-5 w-5 rotate-45" />
        </button>
      </div>
    </div>
  );
}

/**
 * The live edge of an ad card.
 *
 * Never intercepts a pointer: it marks where the drag works, it doesn't
 * handle it. Anything clickable here would compete with the ad for the tap.
 */
function SwipeRail({ side, active }: { side: "left" | "right"; active: number }) {
  const left = side === "left";
  return (
    <span
      aria-hidden
      className={`text-muted pointer-events-none absolute top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 ${
        left ? "left-1" : "right-1"
      }`}
      style={{ opacity: 0.45 + active * 0.55 }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
           strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d={left ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
      <span className="text-[0.5rem] font-bold uppercase tracking-[0.15em] [writing-mode:vertical-rl]">
        Swipe
      </span>
    </span>
  );
}
