/**
 * Which badges this browser has already been told about.
 *
 * The unlock notice has to fire once, at the moment it happens, and never
 * again. The server knows what is earned but not what has been announced, so
 * that part is remembered here.
 *
 * The first read seeds silently. Without that, anyone who had been swiping
 * before this shipped would open the app and be told they had just unlocked
 * fourteen things, which is both false and worthless.
 */

import { useSyncExternalStore } from "react";

const KEY = "motr_badges_seen";
/** Badges earned but not yet looked at, for the dot on the tab. */
const UNSEEN = "motr_badges_unseen";
const EVENT = "motr:badges";

const listeners = new Set<() => void>();

function announce(): void {
  for (const l of listeners) l();
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // No window, nothing listening.
  }
}

function readCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(localStorage.getItem(UNSEEN));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeCount(n: number): void {
  try {
    localStorage.setItem(UNSEEN, String(Math.max(0, Math.floor(n))));
  } catch {
    // Private windows refuse storage; the dot simply never shows.
  }
  announce();
}

/** Called when the badges page is open: everything has now been looked at. */
export function markBadgesSeen(): void {
  if (readCount() !== 0) writeCount(0);
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  window.addEventListener(EVENT, fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
    window.removeEventListener(EVENT, fn);
  };
}

/** Server markup has no localStorage, so the dot appears on hydration. */
export function useUnseenBadges(): number {
  return useSyncExternalStore(subscribe, readCount, () => 0);
}

function read(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private windows refuse storage. The notice simply never fires, which is
    // better than firing on every save.
  }
}

/**
 * Records the badges currently earned and returns the ones that are new.
 *
 * Returns nothing on the first run, which is the seed.
 */
export function newlyEarned(earnedIds: string[]): string[] {
  const seen = read();
  write(earnedIds);
  if (seen === null) return [];
  const before = new Set(seen);
  const fresh = earnedIds.filter((id) => !before.has(id));
  if (fresh.length) writeCount(readCount() + fresh.length);
  return fresh;
}
