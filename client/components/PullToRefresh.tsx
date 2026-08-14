"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pull down from the top to reload.
 *
 * Installed to a home screen, MOTR runs with no browser chrome — and Chrome
 * disables its own pull-to-refresh in standalone mode. So the one gesture
 * everybody already knows did nothing, and the only way to see current data
 * was to leave the app and open the site in a browser instead.
 *
 * Reloads the page outright rather than refetching in place. Every screen
 * fetches its own data on mount, so a reload is the one action guaranteed to
 * bring all of it current, and the service worker caches nothing on the
 * network path so there's no stale copy to serve back.
 */

/** How far to drag before it counts. Short enough to feel light, long enough
 *  that a scroll flick past the top never triggers it. */
const THRESHOLD = 72;

/** Past this the rubber band stops giving, so it can't be dragged forever. */
const MAX_PULL = 110;

export default function PullToRefresh({
  onRefresh,
  children,
}: {
  /** Defaults to a full reload. */
  onRefresh?: () => void;
  children: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pulling = useRef(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Mirrors the ref in state: the transition below depends on whether a
  // finger is down, and reading a ref while rendering isn't allowed.
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    /**
     * The nearest ancestor that actually scrolls.
     *
     * MotrShell scrolls on its own container rather than the document, so
     * asking the window whether we're at the top gives the wrong answer and
     * the gesture fires halfway down a list.
     */
    function scrollTopOf(node: HTMLElement | null): number {
      let n: HTMLElement | null = node;
      while (n && n !== document.body) {
        if (n.scrollHeight > n.clientHeight) {
          const overflow = getComputedStyle(n).overflowY;
          if (overflow === "auto" || overflow === "scroll") return n.scrollTop;
        }
        n = n.parentElement;
      }
      return window.scrollY;
    }

    function onStart(e: TouchEvent) {
      if (refreshing || e.touches.length !== 1) return;
      const t = e.touches[0];
      // Only from the top. Anywhere else this is an ordinary scroll.
      if (scrollTopOf(e.target as HTMLElement) > 0) return;
      start.current = { x: t.clientX, y: t.clientY };
      pulling.current = false;
    }

    function onMove(e: TouchEvent) {
      if (!start.current || refreshing) return;
      const t = e.touches[0];
      const dy = t.clientY - start.current.y;
      const dx = t.clientX - start.current.x;

      // Downward, and clearly more vertical than horizontal — otherwise this
      // is someone swiping a card sideways and must be left alone.
      if (dy <= 0 || Math.abs(dy) < Math.abs(dx) * 1.5) {
        if (!pulling.current) start.current = null;
        return;
      }

      pulling.current = true;
      setDragging(true);
      // Resisted, so it feels like pulling against something.
      const eased = Math.min(MAX_PULL, dy * 0.5);
      setDistance(eased);
      if (e.cancelable) e.preventDefault();
    }

    function onEnd() {
      if (!start.current) return;
      const pulled = distance;
      start.current = null;
      pulling.current = false;
      setDragging(false);

      if (pulled >= THRESHOLD) {
        setRefreshing(true);
        setDistance(THRESHOLD);
        // Let the spinner paint before the thread stalls on navigation.
        window.setTimeout(() => {
          if (onRefresh) onRefresh();
          else window.location.reload();
        }, 150);
        return;
      }
      setDistance(0);
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    // Not passive: a real pull has to stop the page moving with it.
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [distance, refreshing, onRefresh]);

  const ready = distance >= THRESHOLD;

  return (
    <div ref={host} className="relative">
      {/* Sits above the content and slides down with the pull. */}
      <div
        aria-hidden={distance === 0}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
        style={{
          transform: `translateY(${distance - 40}px)`,
          opacity: distance === 0 ? 0 : Math.min(1, distance / THRESHOLD),
          transition: dragging ? "none" : "transform 200ms ease, opacity 200ms ease",
        }}
      >
        <div className="border-gold/40 bg-surface text-gold mt-2 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest shadow-lg">
          <span
            className={`border-gold/40 border-t-gold inline-block h-3 w-3 rounded-full border-2 ${
              refreshing ? "animate-spin" : ""
            }`}
            style={{ transform: refreshing ? undefined : `rotate(${distance * 3}deg)` }}
          />
          {refreshing ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"}
        </div>
      </div>

      <div
        style={{
          transform: `translateY(${distance}px)`,
          transition: dragging ? "none" : "transform 200ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
