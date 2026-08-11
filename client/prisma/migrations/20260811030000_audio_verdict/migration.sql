-- Feed Health checked that audio *played*, not that it was the *right* audio.
-- Two of the last two artists to submit had a track playing something else:
-- one a different artist entirely, two a different version of their own song.
--
-- Verifying a track costs an iTunes search and Apple throttles at roughly
-- twenty a minute, so the verdict is stored rather than recomputed. Cleared
-- whenever the preview URL changes, because that is a new claim.
ALTER TABLE "Track" ADD COLUMN "audioVerdict" TEXT;
ALTER TABLE "Track" ADD COLUMN "audioCheckedAt" TIMESTAMP(3);
