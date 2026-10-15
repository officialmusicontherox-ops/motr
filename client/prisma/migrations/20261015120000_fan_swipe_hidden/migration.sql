-- Lets a listener tidy their saved list without retracting the verdict.
--
-- The swipe row stays, so fanRightSwipes, the chart, the weekly recap and
-- milestone emails already sent all remain true, and the unique constraint on
-- (fanId, trackId) still keeps the track out of that listener's feed. Only
-- their own view of it changes.
ALTER TABLE "FanSwipe" ADD COLUMN "hiddenAt" TIMESTAMP(3);
