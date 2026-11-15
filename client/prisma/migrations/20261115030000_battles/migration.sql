-- Battles: two blind songs from one genre, the listener picks one.
--
-- Every battle is a row with a date, so wins can be counted over any week
-- or month. The two counters on Track are the all-time totals, kept so an
-- artist's full record is one read and nobody's history depends on a
-- window: joining the first week must never cost anybody their wins.
ALTER TABLE "Track" ADD COLUMN "battles"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Track" ADD COLUMN "battleWins" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Battle" (
  "id"        TEXT NOT NULL,
  "fanId"     TEXT NOT NULL,
  -- Left and right as shown, randomised when the battle is made so neither
  -- side of the screen has an edge.
  "trackAId"  TEXT NOT NULL,
  "trackBId"  TEXT NOT NULL,
  "genre"     TEXT NOT NULL,
  -- Null on a decided battle means it was skipped, which counts for nobody.
  "winnerId"  TEXT,
  -- Null while the listener still has it open.
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Battle_fanId_decidedAt_idx" ON "Battle"("fanId", "decidedAt");
CREATE INDEX "Battle_trackAId_idx" ON "Battle"("trackAId");
CREATE INDEX "Battle_trackBId_idx" ON "Battle"("trackBId");
CREATE INDEX "Battle_winnerId_decidedAt_idx" ON "Battle"("winnerId", "decidedAt");
