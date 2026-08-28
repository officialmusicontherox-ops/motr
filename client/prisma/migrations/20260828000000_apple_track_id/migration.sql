-- Store Apple's id for each track's audio, so verification can use the lookup
-- endpoint (200 ids per request) instead of one throttled search per track.
-- Checking the whole library goes from impossible to a couple of calls.
ALTER TABLE "Track" ADD COLUMN "appleTrackId" TEXT;
