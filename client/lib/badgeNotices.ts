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

const KEY = "motr_badges_seen";

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
  return earnedIds.filter((id) => !before.has(id));
}
