"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, which is what makes MOTR installable.
 *
 * Android only offers a real app install — a signed WebAPK that lands in the
 * app drawer like anything else — for a site with a manifest *and* a service
 * worker carrying a fetch handler. With the manifest alone the browser falls
 * back to a plain home-screen shortcut, which is the flow that produces
 * unfamiliar "unknown source" prompts on some phones.
 *
 * Renders nothing. Failure is silent on purpose: a browser that can't
 * register one still has a perfectly working website, and an error here
 * would be noise about a feature the visitor never asked for.
 */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // After load, so registering never competes with the first render for
    // bandwidth on a phone.
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
