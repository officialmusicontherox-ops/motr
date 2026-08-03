"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GENRES } from "@/lib/genres";

/**
 * Horizontal genre strip above the card. What someone wants to hear changes
 * by the hour, so this is a one-tap switch that reshuffles the feed rather
 * than a profile setting buried in a menu.
 *
 * Scrolls sideways instead of wrapping — a wrapping grid of fifteen chips
 * would push the card itself off a phone screen. The scrollbar is hidden for
 * looks, which on its own made the strip appear to simply end after Jazz, so
 * the overflow is signalled two ways: a fade at whichever edge has more
 * behind it, and arrow buttons for anyone using a mouse, where sideways
 * scrolling isn't discoverable.
 */
export default function GenrePicker({
  value,
  onChange,
  counts,
}: {
  value: string | null;
  onChange: (genre: string | null) => void;
  /**
   * Unswiped tracks per genre. Used only to hide genres with nothing left —
   * the number itself stays out of the UI, since how much stock sits behind
   * a chip is our business, not the listener's.
   */
  counts?: Record<string, number>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const available = counts
    ? GENRES.filter((g) => (counts[g] ?? 0) > 0 || g === value)
    : GENRES;

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    // A pixel of slack: fractional widths mean these rarely land exactly.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, available.length]);

  function nudge(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  }

  return (
    <div className="relative -mx-5 mb-4">
      {/* Fades sit above the strip but must never eat a tap meant for a chip. */}
      {!atStart && (
        <div
          aria-hidden
          className="from-bg pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r to-transparent"
        />
      )}
      {!atEnd && (
        <div
          aria-hidden
          className="from-bg pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l to-transparent"
        />
      )}

      {/* Arrows are for pointer devices; a touchscreen just swipes. */}
      {!atStart && (
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="Scroll genres left"
          className="border-edge bg-surface text-muted hover:border-gold hover:text-gold absolute left-3 top-1/2 z-20 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border text-xs transition md:flex"
        >
          ‹
        </button>
      )}
      {!atEnd && (
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="Scroll genres right"
          className="border-edge bg-surface text-muted hover:border-gold hover:text-gold absolute right-3 top-1/2 z-20 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border text-xs transition md:flex"
        >
          ›
        </button>
      )}

      <div
        ref={scroller}
        onScroll={measure}
        className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Filter by genre"
      >
        <Chip active={value === null} onClick={() => onChange(null)}>
          All
        </Chip>

        {available.map((g) => (
          <Chip key={g} active={value === g} onClick={() => onChange(value === g ? null : g)}>
            {/* The " / " variants are too long for a chip on a phone. */}
            {g.split(" / ")[0]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-gold bg-gold text-bg"
          : "border-edge text-muted hover:border-gold/50 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
