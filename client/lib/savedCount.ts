/**
 * How many tracks this person has kept, shared between the swipe feed and the
 * navigation badge.
 *
 * Deliberately not a fetch. The badge sits in the app shell, which renders on
 * every page, and a count request on every navigation would cost more than the
 * number is worth. The feed already knows when a save succeeds and the saved
 * list already knows the true total, so the number can be maintained from both
 * without asking the server anything extra.
 *
 * localStorage is the right home for it despite being per-device: the badge is
 * a nudge, not a record. The record is in the database, and the saved list
 * reconciles this value against it every time it loads.
 */

import { useSyncExternalStore } from "react";

const KEY = "motr_saved_count";
const EVENT = "motr:saved-count";

const listeners = new Set<() => void>();

function announce(): void {
  for (const l of listeners) l();
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Nothing else is listening in a context without a window.
  }
}

export function readSavedCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function write(n: number): void {
  try {
    localStorage.setItem(KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    // Private windows refuse storage; the badge simply stays at zero.
  }
  announce();
}

/** The server's number, once the saved list has actually loaded it. */
export function publishSavedCount(n: number): void {
  if (n === readSavedCount()) return;
  write(n);
}

/**
 * One more, immediately.
 *
 * Called when a save succeeds rather than when the swipe starts, so the badge
 * never counts something the server rejected.
 */
export function bumpSavedCount(): void {
  write(readSavedCount() + 1);
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // Also follow the native storage event, which fires when the same person
  // has MOTR open in another tab.
  window.addEventListener("storage", fn);
  window.addEventListener(EVENT, fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
    window.removeEventListener(EVENT, fn);
  };
}

/**
 * Server-rendered markup has no localStorage, so the badge is absent in the
 * HTML and appears on hydration. That is the correct trade: a number baked
 * into the server response would be wrong for everyone it was not rendered for.
 */
export function useSavedCount(): number {
  return useSyncExternalStore(subscribe, readSavedCount, () => 0);
}
