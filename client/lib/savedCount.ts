/**
 * The unread badge on the Saved tab.
 *
 * It counts saves the person has not looked at yet, not how many they have.
 * An outstanding number that never clears stops being information and starts
 * being nagging, so opening Saved takes it back to nothing and only a new save
 * brings it back.
 *
 * Two values make that work: the best known total, and the total as it stood
 * the last time Saved was opened. The badge is the difference. Storing the
 * difference alone would be wrong, because the saved list only ever learns the
 * total, and would have nothing to subtract from.
 *
 * Deliberately not a fetch. The badge renders in the app shell on every page,
 * and a count request per navigation would cost more than the number is worth.
 * The feed knows when a save succeeds and the saved list knows the real total,
 * which between them is enough. localStorage is per-device, which is the right
 * trade for a nudge; the record itself lives in the database.
 */

import { useSyncExternalStore } from "react";

const TOTAL = "motr_saved_count";
const SEEN = "motr_saved_seen";
const EVENT = "motr:saved-count";

const listeners = new Set<() => void>();

function announce(): void {
  for (const l of listeners) l();
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Nothing is listening without a window.
  }
}

function read(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function write(key: string, n: number): void {
  try {
    localStorage.setItem(key, String(Math.max(0, Math.floor(n))));
  } catch {
    // Private windows refuse storage; the badge just stays empty.
  }
}

/** Saves made since Saved was last opened. */
export function unseenSaves(): number {
  return Math.max(0, read(TOTAL) - read(SEEN));
}

/**
 * One more, immediately.
 *
 * Called when a save succeeds rather than when the swipe starts, so the badge
 * never counts something the server rejected.
 */
export function bumpSavedCount(): void {
  write(TOTAL, read(TOTAL) + 1);
  announce();
}

/**
 * Called when the saved list is on screen: everything up to now has been seen.
 *
 * `total` is the server's count when the list loaded. Without it the current
 * total is used, so a failed request still clears the badge rather than
 * leaving a number the person has already been shown the list for.
 */
export function markSavesSeen(total?: number): void {
  const n = typeof total === "number" && Number.isFinite(total) ? Math.max(0, Math.floor(total)) : read(TOTAL);
  write(TOTAL, n);
  write(SEEN, n);
  announce();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // The native storage event covers MOTR being open in a second tab.
  window.addEventListener("storage", fn);
  window.addEventListener(EVENT, fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
    window.removeEventListener(EVENT, fn);
  };
}

/**
 * Server-rendered markup has no localStorage, so the badge is absent from the
 * HTML and appears on hydration. That is the correct trade: a number baked
 * into the server response would be wrong for everyone it was not rendered for.
 */
export function useUnseenSaves(): number {
  return useSyncExternalStore(subscribe, unseenSaves, () => 0);
}
