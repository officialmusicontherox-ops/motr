-- Spotlights a listener holds and has not spent yet.
--
-- A balance rather than a purchase at the moment of use, because the only
-- place a Spotlight makes sense to spend is mid-swipe, and a card cannot
-- stop to take money without destroying the thing it is interrupting. You
-- buy a few, then spend them the instant something lands.
ALTER TABLE "Fan" ADD COLUMN "spotlightCredits" INTEGER NOT NULL DEFAULT 0;

-- Which track was playing when it was spent. The artist is who gets the
-- slot, but a Spotlight bought off a blind card is worth being able to trace
-- back to the song that earned it.
ALTER TABLE "Spotlight" ADD COLUMN "trackId" TEXT;
