"use client";

import { useState } from "react";
import { BUNDLES, CAP_PLACES, SALE, SPOTLIGHT_SPAN, bonusFor, price, saleOn } from "@/lib/spotlightBundles";
import { Cross } from "./icons";

/**
 * What a Spotlight is, and how to get some.
 *
 * Shown when somebody reaches for one they do not have, which is the only
 * moment the explanation is wanted. It is never put in front of a listener
 * who has not asked.
 */
export default function SpotlightOffer({
  onClose,
  artistName,
}: {
  onClose: () => void;
  /** Named when the offer came from an artist rather than from a swipe. */
  artistName?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  async function buy(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/spotlight/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bundle: id }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.url) {
        window.location.href = d.url;
        return;
      }
      // Not open yet, rather than a failure. Saying so beats a button that
      // looks broken.
      setClosed(true);
    } catch {
      setClosed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Spotlights"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="border-edge bg-surface pb-safe w-full max-w-sm rounded-t-3xl border p-5 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl uppercase tracking-wide">Spotlights</p>
            <p className="text-muted mt-1 text-sm leading-relaxed">
              {artistName
                ? `Put ${artistName} on the Spotlight tab for ${SPOTLIGHT_SPAN}, where everyone sees who they are.`
                : `Swipe up on something you love and that artist goes on the Spotlight tab for ${SPOTLIGHT_SPAN}, named, where everyone sees them.`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border-edge text-muted hover:text-ink flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition"
          >
            <Cross className="h-3 w-3" />
          </button>
        </div>

        {closed ? (
          <p className="text-muted mt-5 text-sm">
            Spotlights aren&apos;t on sale just yet. Check back shortly.
          </p>
        ) : (
          <div className="mt-5 space-y-2">
            {saleOn() && (
              <p className="border-gold/40 bg-gold/10 text-gold rounded-xl border px-3 py-2 text-xs font-semibold">
                {SALE.name}: free bonus Spotlights on bundles through {SALE.endsLabel}.
              </p>
            )}
            {BUNDLES.map((b) => (
              <button
                key={b.id}
                onClick={() => buy(b.id)}
                disabled={busy !== null}
                className="border-edge hover:border-gold flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition disabled:opacity-40"
              >
                <span>
                  <span className="font-semibold">{b.label}</span>
                  {bonusFor(b.id) > 0 && (
                    <span className="bg-gold text-bg ml-2 rounded-full px-2 py-px text-[0.65rem] font-bold">
                      +{bonusFor(b.id)} free
                    </span>
                  )}
                  {bonusFor(b.id) === 0 && "note" in b && b.note && (
                    <span className="text-gold ml-2 text-[0.65rem] font-bold uppercase tracking-widest">
                      {b.note}
                    </span>
                  )}
                </span>
                <span className="text-gold font-bold tabular-nums">
                  {busy === b.id ? "..." : price(b.cents)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* The one thing that must be said plainly, because the whole app
            rests on it. */}
        {/* The things somebody is owed before they pay. The cap belongs
            here rather than in a surprise after: spending another on the
            same artist queues it instead of putting it up. */}
        <p className="text-muted mt-4 text-xs leading-relaxed">
          A Spotlight is promotion, not a vote. It never counts toward the
          charts. An artist can hold {CAP_PLACES} at a time, so another
          one for the same artist waits and starts when theirs ends. Purchases are non-refundable.
        </p>
      </div>
    </div>
  );
}
