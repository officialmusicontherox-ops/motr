"use client";

import { useEffect } from "react";

/**
 * Reports browser errors so they reach the admin dashboard instead of only
 * the user's console.
 *
 * Covers both an uncaught throw and a rejected promise that nothing handled —
 * the second is how a failed fetch usually surfaces, and it's silent
 * otherwise.
 */
export default function ClientErrorReporter() {
  useEffect(() => {
    const send = (message: string, stack?: string) => {
      // keepalive so a report still goes out if the error killed the page.
      fetch("/api/errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, stack, path: window.location.pathname }),
        keepalive: true,
      }).catch(() => {});
    };

    const onError = (e: ErrorEvent) => send(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      send(
        r instanceof Error ? r.message : `Unhandled rejection: ${String(r)}`,
        r instanceof Error ? r.stack : undefined
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
