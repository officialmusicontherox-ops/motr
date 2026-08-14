"use client";

import { useEffect, useRef } from "react";

/**
 * Runs a callback when the app comes back to the foreground.
 *
 * Installed to a home screen, MOTR runs with no browser chrome — no address
 * bar, no reload button, nothing to pull down. A screen that fetched its data
 * once on mount then showed it forever, and the only way to see current
 * numbers was to abandon the app and sign in through a browser instead.
 *
 * Reopening an app is exactly the moment someone expects fresh data, so
 * that's the trigger. Only after a real absence, so flicking to another app
 * for a couple of seconds doesn't refetch everything underneath them.
 */
export function useRefreshOnReturn(onReturn: () => void, minAwayMs = 30_000) {
  const hiddenSince = useRef<number | null>(null);
  const latest = useRef(onReturn);
  latest.current = onReturn;

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = Date.now();
        return;
      }
      const away = hiddenSince.current ? Date.now() - hiddenSince.current : 0;
      hiddenSince.current = null;
      if (away >= minAwayMs) latest.current();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [minAwayMs]);
}
