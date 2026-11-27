"use client";

import { useState, useSyncExternalStore } from "react";
import SpotlightOffer from "./SpotlightOffer";
import { SALE, saleOn } from "@/lib/spotlightBundles";
import { safeLocal } from "@/lib/storage";

const KEY = "motr_sale_dismissed_blackfriday2026";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/**
 * A thin strip across the top of the app while a Spotlight sale is on.
 * Tapping it opens the Spotlight bundles, ready to buy; the x hides it for
 * good on this device. Gone by itself when the sale ends.
 *
 * Treated as dismissed until the browser has said otherwise, so it never
 * flashes up for someone who has already closed it.
 */
export default function SaleBanner() {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => safeLocal.getItem(KEY) === "1",
    () => true
  );
  const [closed, setClosed] = useState(false);
  const [offer, setOffer] = useState(false);

  if (!saleOn()) return null;

  return (
    <>
      {!dismissed && !closed && (
        <div className="border-gold/30 bg-gold/10 flex items-center gap-2 border-b px-3 py-1.5">
          <button
            onClick={() => setOffer(true)}
            className="text-gold min-w-0 flex-1 text-center text-[0.72rem] font-semibold leading-snug"
          >
            Black Friday: 50% off Spotlight bundles through {SALE.endsLabel}.{" "}
            <span className="underline underline-offset-2">Get them</span>
          </button>
          <button
            onClick={() => {
              safeLocal.setItem(KEY, "1");
              setClosed(true);
            }}
            aria-label="Hide this offer"
            className="text-gold/70 hover:text-gold flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
      {offer && <SpotlightOffer onClose={() => setOffer(false)} />}
    </>
  );
}
