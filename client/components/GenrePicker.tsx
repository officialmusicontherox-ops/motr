"use client";

import { GENRES } from "@/lib/genres";

/**
 * Horizontal genre strip above the card. What someone wants to hear changes
 * by the hour, so this is a one-tap switch that reshuffles the feed rather
 * than a profile setting buried in a menu.
 *
 * Scrolls sideways instead of wrapping — a wrapping grid of 15 chips would
 * push the card itself off a phone screen.
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
  const available = counts
    ? GENRES.filter((g) => (counts[g] ?? 0) > 0 || g === value)
    : GENRES;

  return (
    <div
      className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
