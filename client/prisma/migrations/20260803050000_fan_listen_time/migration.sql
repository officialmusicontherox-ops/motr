-- How long the fan actually listened before deciding. A right-swipe at four
-- seconds and one at twenty-eight are not the same verdict, and the
-- difference is the most useful thing we know about a track.
ALTER TABLE "FanSwipe" ADD COLUMN "listenMs" INTEGER;
CREATE INDEX "FanSwipe_trackId_idx" ON "FanSwipe"("trackId");
