"use client";

import { useEffect, useState } from "react";
import { Cross } from "./icons";

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

        {failed ? (
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
      </div>
    </div>
  );
}
