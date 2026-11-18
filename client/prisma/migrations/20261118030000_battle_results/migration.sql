-- A battle whose opponent was pulled is won by the other song, not called off.
ALTER TABLE "Battle" ADD COLUMN "forfeitAt" TIMESTAMP(3);

-- When each side's artist was sent their result.
ALTER TABLE "Battle" ADD COLUMN "resultSentAAt" TIMESTAMP(3);
ALTER TABLE "Battle" ADD COLUMN "resultSentBAt" TIMESTAMP(3);

-- Results settled before this existed are not written to after the fact.
UPDATE "Battle" SET "resultSentAAt" = NOW(), "resultSentBAt" = NOW() WHERE "settledAt" IS NOT NULL;
