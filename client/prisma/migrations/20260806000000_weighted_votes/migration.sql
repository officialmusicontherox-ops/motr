-- A verdict reached after hearing the clip out counts double.
--
-- The average decision was arriving 5.1 seconds into a 30-second preview,
-- which is a reaction to a first impression rather than to a song. Weighting
-- by attention means the tracks that break through are the ones people sat
-- with, without slowing down anyone who wants to swipe fast.
--
-- The raw fanRightSwipes/fanLeftSwipes counters are deliberately left alone:
-- they are shown as headcounts ("3 people saved this") and must keep meaning
-- people rather than points. The gate reads the weighted columns instead.

ALTER TABLE "FanSwipe" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Track" ADD COLUMN "weightedRightVotes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Track" ADD COLUMN "weightedTotalVotes" INTEGER NOT NULL DEFAULT 0;

-- Backfill history on the same rule, so tracks that already earned attention
-- keep the credit rather than restarting from zero.
UPDATE "FanSwipe" SET "weight" = 2 WHERE "listenMs" >= 28000;

UPDATE "Track" t
SET "weightedRightVotes" = COALESCE(s.right_votes, 0),
    "weightedTotalVotes" = COALESCE(s.total_votes, 0)
FROM (
  SELECT "trackId",
         SUM(CASE WHEN "direction" = 'RIGHT' THEN "weight" ELSE 0 END)::int AS right_votes,
         SUM("weight")::int AS total_votes
  FROM "FanSwipe"
  GROUP BY "trackId"
) s
WHERE t."id" = s."trackId";
