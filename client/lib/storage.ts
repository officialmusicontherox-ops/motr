/**
 * Browser storage that cannot take the page down.
 *
 * localStorage is not always there. Some in-app browsers, the ones inside
 * email and social apps, do not define it at all, and others throw when it
 * is touched with storage blocked. Reading it bare inside an effect then
 * stops the whole screen: on 15 Nov 2026 a listener who opened a battle
 * link from an email got "Can't find variable: localStorage" and nothing
 * else, because the gate in front of every page read it unguarded.
 *
 * These never throw. A read that cannot happen returns null, which is what
 * storage says for a key that was never set, and a write that cannot happen
 * is dropped. The app then behaves as it does on a first visit, which is
 * the worst that losing a convenience should cost.
 */
function make(kind: "localStorage" | "sessionStorage") {
  const store = (): Storage | null => {
    try {
      return typeof window === "undefined" ? null : window[kind];
    } catch {
      return null;
    }
  };
  return {
    getItem(key: string): string | null {
      try {
        return store()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        store()?.setItem(key, value);
      } catch {
        // Full, blocked or absent. Nothing depends on this having worked.
      }
    },
    removeItem(key: string): void {
      try {
        store()?.removeItem(key);
      } catch {
        // As above.
      }
    },
  };
}

export const safeLocal = make("localStorage");
export const safeSession = make("sessionStorage");
