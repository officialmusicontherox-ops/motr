"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import MotrShell from "./MotrShell";

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
 *
 * All six tiles sit on one screen and the page does not scroll, on a phone
 * or a laptop. Six tiles stacked one per row was a long scroll that only
 * ever showed one artist at a time, which defeats the point of a shelf: you
 * are meant to see the whole shelf and pick. The grid is sized by the space
 * available rather than by a fixed aspect ratio, so the tiles get shorter on
 * a small phone instead of pushing the last row under the fold.
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
    <MotrShell fill>
      <div className="flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <h1 className="font-display shrink-0 text-center text-xl uppercase tracking-wide md:text-2xl">
          Spotlight
        </h1>
        <p className="text-muted mx-auto mt-1 max-w-md shrink-0 text-center text-xs md:text-sm">
          Artists someone wanted you to hear. Tap a logo to listen.
        </p>

        {error ? (
          <p className="text-muted mt-8 text-center text-sm">
            Couldn&apos;t load the Spotlight right now. Pull down to try again.
          </p>
        ) : (
          /* Two by three on a phone, three by two on a laptop, and the rows
             divide whatever height is left. grid-rows is what keeps it to one
             screen: without it the rows size to their content and the third
             row lands under the tab bar. */
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2.5 pb-1 md:grid-cols-3 md:grid-rows-2 md:gap-4">
            {/* Six placeholders rather than a spinner, so nothing moves when
                the real tiles arrive. */}
            {(tiles ?? Array.from({ length: 6 }, () => null)).map((t, i) =>
              t ? <TileCard key={t.artistId} t={t} /> : <Skeleton key={i} />
            )}
          </div>
        )}
      </div>
    </MotrShell>
  );
}

function TileCard({ t }: { t: Tile }) {
  return (
    <div className="border-edge bg-surface flex min-h-0 flex-col overflow-hidden rounded-2xl border">
      <div className="bg-surface-2 relative min-h-0 flex-1">
        {t.image ? (
          <Image
            src={t.image}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, 256px"
            // Same as the charts and the swipe card: these come from Spotify
            // and Apple, which are not in the image allowlist, and optimising
            // someone else's CDN buys nothing.
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="text-muted flex h-full items-center justify-center text-xs">
            No photo
          </div>
        )}
      </div>

      <div className="shrink-0 px-2.5 py-2 md:px-3 md:py-2.5">
        {/* Under the photo rather than over it: on the mockup the badge
            landed on the artwork and fought with it. */}
        {t.paid && (
          <span className="bg-gold text-bg mb-1 inline-block rounded-full px-2 py-px text-[0.58rem] font-bold uppercase tracking-widest">
            Spotlight
          </span>
        )}

        <p className="truncate text-[0.82rem] font-semibold md:text-sm">{t.name}</p>

        <div className="mt-0.5 flex items-center gap-1">
          <p className="text-muted min-w-0 flex-1 truncate text-[0.68rem] md:text-xs">
            {t.genre?.split(" /")[0] ?? "Music"}
            {t.monthlyListeners !== null && ` · ${listeners(t.monthlyListeners)} listeners`}
          </p>

          {/* Two marks rather than two buttons. Buttons cost a row of artwork
              each, and the logos say where the tap goes without a word on
              them. Each one goes to that artist's own page on that service,
              so nobody is sent to whichever one we picked for them. */}
          {t.spotifyUrl && (
            <a
              href={t.spotifyUrl}
              target="_blank"
              rel="noopener"
              aria-label={`${t.name} on Spotify`}
              title="Open on Spotify"
              className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:bg-white/5"
            >
              <SpotifyMark className="h-[18px] w-[18px] text-[#1DB954]" />
            </a>
          )}
          {t.appleUrl && (
            <a
              href={t.appleUrl}
              target="_blank"
              rel="noopener"
              aria-label={`${t.name} on Apple Music`}
              title="Open on Apple Music"
              className="-my-1 -mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:bg-white/5"
            >
              <AppleMusicMark className="h-[18px] w-[18px] text-[#FA243C]" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="border-edge bg-surface flex min-h-0 flex-col overflow-hidden rounded-2xl border">
      <div className="bg-surface-2 min-h-0 flex-1 animate-pulse" />
      <div className="shrink-0 px-2.5 py-2 md:px-3 md:py-2.5">
        <div className="bg-surface-2 h-3 w-3/4 animate-pulse rounded" />
        <div className="bg-surface-2 mt-1.5 h-2.5 w-1/2 animate-pulse rounded" />
      </div>
    </div>
  );
}

function SpotifyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.8.8 0 0 1-1.1.3c-3-1.9-6.8-2.3-11.3-1.3a.8.8 0 1 1-.3-1.5c4.9-1.1 9.1-.6 12.4 1.4.4.2.5.7.3 1.1Zm1.2-2.8a1 1 0 0 1-1.3.3c-3.4-2.1-8.6-2.7-12.6-1.5a1 1 0 0 1-.6-1.9c4.6-1.4 10.3-.7 14.2 1.7.5.3.6.9.3 1.4Zm.1-2.9C14 8.4 7.7 8.2 4.2 9.2a1.2 1.2 0 1 1-.7-2.3C7.6 5.7 14.5 6 19 8.6a1.2 1.2 0 0 1-1.2 2.1Z" />
    </svg>
  );
}

function AppleMusicMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.6 2H6.4A4.4 4.4 0 0 0 2 6.4v11.2A4.4 4.4 0 0 0 6.4 22h11.2a4.4 4.4 0 0 0 4.4-4.4V6.4A4.4 4.4 0 0 0 17.6 2Zm-1.1 3.9v8.6a2.4 2.4 0 0 1-1.9 2.4c-1.2.2-2.1-.5-2.1-1.5s.7-1.7 1.8-1.9l.7-.1c.4-.1.5-.2.5-.6V8.6c0-.3-.1-.4-.4-.3l-4 .8c-.3.1-.4.2-.4.5v6.9a2.4 2.4 0 0 1-1.9 2.4c-1.2.2-2.1-.5-2.1-1.5s.7-1.7 1.8-1.9l.7-.1c.4-.1.5-.2.5-.6V7.4c0-.6.3-.9.9-1l5.9-1.2c.6-.1 1 .2 1 .8v-.1Z" />
    </svg>
  );
}
