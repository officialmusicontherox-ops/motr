-- Weekly re-engagement email for listeners who signed in, swiped, and then
-- stopped coming back. 1 of 19 listeners has ever returned on a later day,
-- and nothing in the product asks them to.
--
-- nudgeCount exists so this can't become a weekly nag: it stops after a few
-- unanswered sends and resets the moment someone swipes again. emailOptOut is
-- the unsubscribe, which a recurring email has to honour.

ALTER TABLE "Fan" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Fan" ADD COLUMN "lastNudgeAt" TIMESTAMP(3);
ALTER TABLE "Fan" ADD COLUMN "nudgeCount" INTEGER NOT NULL DEFAULT 0;
