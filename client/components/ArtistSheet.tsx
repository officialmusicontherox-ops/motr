"use client";

import { useEffect, useState } from "react";
import { Cross, Note } from "./icons";
import SpotlightOffer from "./SpotlightOffer";
import { SPOTLIGHT_SPAN } from "@/lib/spotlightBundles";

type Card = {
  artistId: string;
  name: string;
  genre: string | null;
  image: string | null;
  monthlyListeners: number | null;
  spotifyUrl: string | null;
  appleUrl: string | null;
};

function listeners(n: number) {
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/**
 * Who made this, pulled up by tapping an artist's name in Saved.
 *
 * Saved is where the names are already revealed, so this is the one place a
 * listener is thinking about the artist rather than the song. It carries the
 * same public card the Spotlight tab shows: photo, genre, listeners where
 * there are enough of them, and the two places to go hear more.
 */
export default function ArtistSheet({
  artistId,
  fallbackName,
  onClose,
}: {
  artistId: string;
  fallbackName: string;
  onClose: () => void;
}) {
  const [card, setCard] = useState<Card | null>(null);
  const [failed, setFailed] = useState(false);
  const [credits, setCredits] = useState(0);
  const [offer, setOffer] = useState(false);
  const [spending, setSpending] = useState(false);
  const [done, setDone] = useState<"live" | "queued" | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/spotlight/artist/${artistId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => live && setCard(d.artist))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [artistId]);

  useEffect(() => {
    fetch("/api/spotlight/spend")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => typeof d?.credits === "number" && setCredits(d.credits))
      .catch(() => {});
  }, []);

  /**
   * Spend one on them.
   *
   * Nothing here takes money. If they have none, the offer opens instead, so
   * the only thing that ever happens inside this sheet is a Spotlight they
   * already hold being used.
   */
  async function spend() {
    if (credits < 1) {
      setOffer(true);
      return;
    }
    setSpending(true);
    try {
      const res = await fetch("/api/spotlight/spend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      const d = await res.json().catch(() => null);
      if (res.status === 402) {
        setCredits(0);
        setOffer(true);
        return;
      }
      if (!res.ok) return;
      if (typeof d?.credits === "number") setCredits(d.credits);
      setDone(d?.queued ? "queued" : "live");
    } catch {
      // Nothing was spent, so the button simply comes back.
    } finally {
      setSpending(false);
    }
  }

  // Escape closes it, the same as the backdrop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={fallbackName}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="border-edge bg-surface pb-safe w-full max-w-sm rounded-t-3xl border p-5 sm:rounded-3xl"
      >
        <div className="flex items-start gap-4">
          <div className="bg-surface-2 h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
            {card?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.image} alt="" className="h-full w-full object-cover" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{card?.name ?? fallbackName}</p>
            <p className="text-muted mt-0.5 truncate text-sm">
              {card?.genre?.split(" /")[0] ?? "Music"}
              {card?.monthlyListeners != null &&
                ` · ${listeners(card.monthlyListeners)} monthly listeners`}
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

        {done ? (
          /* Says what actually happened. A queued slot is not a failure, but
             pretending it is already live would be a lie they would catch. */
          <p className="text-gold mt-4 flex items-center gap-2 text-sm">
            <Note className="h-4 w-4 shrink-0" />
            {done === "live"
              ? `${card?.name ?? fallbackName} is on the Spotlight tab for the next ${SPOTLIGHT_SPAN}.`
              : `All six slots are taken. ${card?.name ?? fallbackName} goes up the moment one frees, for a full ${SPOTLIGHT_SPAN}.`}
          </p>
        ) : failed ? (
          <p className="text-muted mt-4 text-sm">Couldn&apos;t load their profile right now.</p>
        ) : (
          <div className="mt-5 flex gap-2">
            {card?.spotifyUrl && (
              <a
                href={card.spotifyUrl}
                target="_blank"
                rel="noopener"
                className="bg-gold text-bg flex-1 rounded-full py-2.5 text-center text-sm font-bold"
              >
                Spotify
              </a>
            )}
            {card?.appleUrl && (
              <a
                href={card.appleUrl}
                target="_blank"
                rel="noopener"
                className="border-edge hover:border-gold flex-1 rounded-full border py-2.5 text-center text-sm transition"
              >
                Apple Music
              </a>
            )}
            {card && !card.spotifyUrl && !card.appleUrl && (
              <p className="text-muted text-sm">No artist page on file for them yet.</p>
            )}
          </div>
        )}

        {card && !done && (
          <button
            onClick={spend}
            disabled={spending}
            className="border-gold/50 text-gold hover:bg-gold/10 mt-2.5 flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-semibold transition disabled:opacity-40"
          >
            <Note className="h-4 w-4" />
            {spending
              ? "Putting them up..."
              : credits > 0
                ? `Put them in the Spotlight · ${credits} left`
                : "Put them in the Spotlight"}
          </button>
        )}
      </div>

      {offer && (
        <SpotlightOffer onClose={() => setOffer(false)} artistName={card?.name ?? fallbackName} />
      )}
    </div>
  );
}
