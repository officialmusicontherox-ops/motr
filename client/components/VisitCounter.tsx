"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Tells the server a page was viewed.
 *
 * Deliberately fires on every path change rather than once per session: the
 * question being answered is whether people who arrive go anywhere, and a
 * single ping on arrival cannot tell a bounce from a visit. Sends at most once
 * per path per tab, so a re-render or a back button does not inflate it.
 */
export default function VisitCounter() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const key = `motr.seen:${pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private browsing. Counting twice beats not counting.
    }

    fetch("/api/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        fromShare: new URLSearchParams(window.location.search).has("track"),
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
