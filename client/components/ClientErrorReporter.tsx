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
/**
 * Keeps the page alive when the browser translates it.
 *
 * Chrome's built-in translate (and Google Translate) replace each piece of
 * text with their own wrapped copy. When the page then changes that text,
 * React goes to remove the node it put there, finds the translator has
 * moved it, and the whole page falls over with "Failed to execute
 * 'removeChild' on 'Node'". It was happening on the Charts page for a
 * listener with an Android phone set to another language.
 *
 * The standard workaround from the React issue tracker: if the node has
 * already been moved, skip the removal instead of throwing. Nothing
 * changes for anyone whose page is not being translated.
 */
if (typeof window !== "undefined" && typeof Node === "function" && Node.prototype) {
  const proto = Node.prototype as Node & { __motrPatched?: boolean };
  if (!proto.__motrPatched) {
    proto.__motrPatched = true;
    const removeChild = proto.removeChild;
    proto.removeChild = function <T extends Node>(this: Node, child: T): T {
      if (child.parentNode !== this) return child;
      return removeChild.call(this, child) as T;
    };
    const insertBefore = proto.insertBefore;
    proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
      if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null) as T;
      return insertBefore.call(this, node, ref) as T;
    };
  }
}

export default function ClientErrorReporter() {
  useEffect(() => {
    // Thrown by the phone app the page was opened inside, not by MOTR. An
    // Android in-app browser (Facebook, Instagram and the like) injects its
    // own script into every page, and when the app closes that view its
    // script fails with this message. Nothing on the page breaks and there
    // is nothing here to change, so it is kept out of the log.
    //
    // "Object Not Found Matching Id" is the same kind of thing from
    // Microsoft's link scanners: Outlook opens every link in an email in a
    // headless browser to check it is safe, and that browser's own script
    // fails this way. It arrived the day an outreach email went out.
    const NOT_OURS = /Java object is gone|Error invoking postMessage|Object Not Found Matching Id/i;

    const send = (message: string, stack?: string) => {
      if (NOT_OURS.test(message)) return;
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
