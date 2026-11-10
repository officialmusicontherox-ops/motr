"use client";

import { useEffect } from "react";

/**
 * Reports browser errors so they reach the admin dashboard instead of only
 * the user's console.
 *
 * Covers both an uncaught throw and a rejected promise that nothing handled,
 * the second being how a failed fetch usually surfaces and silent otherwise.
 *
 * What it deliberately does not report: a rejection that carries no reason
 * at all. Four of those reached the dashboard over three weeks, from four
 * different browsers on four different pages, each saying "Unhandled
 * rejection: undefined" with no stack. A promise rejecting with nothing is
 * almost always a fetch aborted because somebody navigated away, a browser
 * extension, or an in-app browser's own injected code. One of those was
 * traced to Meta's analytics script. They cannot be diagnosed, and they
 * crowd out faults that can.
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

      if (r instanceof Error) {
        send(r.message, r.stack);
        return;
      }

      // Nothing to report and nothing to find. Anything thrown deliberately
      // carries a value, so a reason of null or undefined did not come from
      // code we wrote.
      if (r === undefined || r === null) {
        return;
      }

      // A reason that is not an Error still has content worth keeping, so it
      // is reported with a stack captured here. That will not point at the
      // original throw, but it does say which page and which bundle, which
      // is more than the message alone gave.
      send(`Unhandled rejection: ${String(r).slice(0, 300)}`, new Error("captured at report time").stack);
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
