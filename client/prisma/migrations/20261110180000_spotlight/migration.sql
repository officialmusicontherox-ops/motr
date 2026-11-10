-- The Spotlight tab: artists a listener paid to put in front of everyone.
--
-- A promo surface, deliberately outside the feed. It names the artist, so it
-- can never contaminate the blind data: the chart and the A&R figures only
-- ever count verdicts given without a name attached, and nothing here is a
-- verdict at all.

-- Enough of an artist's public profile to render a tile, cached rather than
-- fetched live. Two page reads per artist is far too slow to do on a view,
-- and Spotify would rate-limit it.
ALTER TABLE "Artist" ADD COLUMN "spotifyArtistId"   TEXT;
ALTER TABLE "Artist" ADD COLUMN "photoUrl"          TEXT;
ALTER TABLE "Artist" ADD COLUMN "monthlyListeners"  INTEGER;
ALTER TABLE "Artist" ADD COLUMN "appleArtistUrl"    TEXT;
ALTER TABLE "Artist" ADD COLUMN "profileFetchedAt"  TIMESTAMP(3);

CREATE TABLE "Spotlight" (
  "id"        TEXT NOT NULL,
  "artistId"  TEXT NOT NULL,
  -- Seven days in a slot. Where all six are taken, a purchase waits and its
  -- seven days begin when one frees, so nobody pays for time they lose.
  "startsAt"  TIMESTAMP(3),
  "endsAt"    TIMESTAMP(3),
  -- Who bought it. Null for one placed by hand from the dashboard.
  "fanId"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Spotlight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Spotlight_startsAt_endsAt_idx" ON "Spotlight"("startsAt", "endsAt");
CREATE INDEX "Spotlight_artistId_idx" ON "Spotlight"("artistId");

ALTER TABLE "Spotlight" ADD CONSTRAINT "Spotlight_artistId_fkey"
  FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
