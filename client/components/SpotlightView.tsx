"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Tile = {
  artistId: string;
  name: string;
  genre: string | null;
  image: string | null;
  monthlyListeners: number | null;
  spotifyUrl: string | null;
  appleUrl: string | null;
  paid: boolean;
};

/** "12K", "6.0K", "430". Rounded, because the source is rounded. */
function listeners(n: number) {
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/**
 * The Spotlight tab.
 *
 * A promo surface, not part of the feed. Every tile names the artist and
 * links out, so nothing here is a blind verdict and nothing can reach the
 * chart. That separation is the whole reason a Spotlight can be bought
 * without making the chart buyable.
 */
export default function SpotlightView() {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/spotlight")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setTiles(d.tiles))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8">
      <h1 className="font-display mt-2 text-center text-2xl uppercase tracking-wide">Spotlight</h1>
      <p className="text-muted mx-auto mt-2 max-w-md text-center text-sm leading-relaxed">
        Artists someone wanted you to hear. Tap through and listen.
      </p>

      {error && (
        <p className="text-muted mt-8 text-center text-sm">
          Couldn&apos;t load the Spotlight right now. Pull down to try again.
        </p>
      )}

      {!tiles && !error && <p className="text-muted mt-8 text-center text-sm">Loading...</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles?.map((t) => (
          <div
            key={t.artistId}
            className="border-edge bg-surface overflow-hidden rounded-2xl border"
          >
            <div className="bg-surface-2 relative aspect-square w-full">
              {t.image ? (
                <Image
                  src={t.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  // Same as the charts and the swipe card: these come from
                  // Spotify and Apple, which are not in the image allowlist,
                  // and optimising someone else's CDN buys nothing.
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="text-muted flex h-full items-center justify-center text-sm">
                  No photo
                </div>
              )}
            </div>

            <div className="p-4">
              {/* Under the photo rather than over it: on the mockup the badge
                  landed on the artwork and fought with it. */}
              {t.paid && (
                <span className="bg-gold text-bg mb-2 inline-block rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest">
                  Spotlight
                </span>
              )}

              <p className="truncate font-semibold">{t.name}</p>
              <p className="text-muted mt-0.5 truncate text-sm">
                {t.genre?.split(" /")[0] ?? "Music"}
                {t.monthlyListeners !== null && ` · ${listeners(t.monthlyListeners)} listeners`}
              </p>

              <div className="mt-3 flex gap-2">
                {t.spotifyUrl && (
                  <a
                    href={t.spotifyUrl}
                    target="_blank"
                    rel="noopener"
                    className="bg-gold text-bg flex-1 rounded-full py-2 text-center text-sm font-bold"
                  >
                    Spotify
                  </a>
                )}
                {t.appleUrl && (
                  <a
                    href={t.appleUrl}
                    target="_blank"
                    rel="noopener"
                    className="border-edge hover:border-gold flex-1 rounded-full border py-2 text-center text-sm transition"
                  >
                    Apple
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
