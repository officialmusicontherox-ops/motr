-- Battles: two blind songs from one genre, the same pair for every listener.
--
-- A battle belongs to a chart week, Sunday to Saturday Central. It opens
-- when it is paired and closes with the week, whenever in the week it was
-- made. The song with more votes when it closes takes a Battle Win.
--
-- The two counters on Track are the all-time record, written when a week
-- is settled, so an artist's full history is one read and never depends on
-- a window: joining in the first week must never cost anybody their wins.
ALTER TABLE "Track" ADD COLUMN "battles"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Track" ADD COLUMN "battleWins" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Battle" (
  "id"        TEXT NOT NULL,
  -- The Sunday the week began, midnight Central.
  "weekStart" TIMESTAMP(3) NOT NULL,
  "genre"     TEXT NOT NULL,
  -- Left and right as shown, a coin toss when paired so neither side of
  -- the screen has an edge.
  "trackAId"  TEXT NOT NULL,
  "trackBId"  TEXT NOT NULL,
  "votesA"    INTEGER NOT NULL DEFAULT 0,
  "votesB"    INTEGER NOT NULL DEFAULT 0,
  -- Set once the week is over and the result has been counted.
  "settledAt" TIMESTAMP(3),
  -- Null after settling means a tie or no votes: nobody takes a win.
  "winnerId"  TEXT,
  -- When each side's artist was told their song is in this battle. Kept
  -- per side so a battle paired mid-week can be announced later without
  -- anybody who already heard being written to twice.
  "notifiedAAt" TIMESTAMP(3),
  "notifiedBAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Battle_weekStart_idx" ON "Battle"("weekStart");
CREATE INDEX "Battle_trackAId_idx" ON "Battle"("trackAId");
CREATE INDEX "Battle_trackBId_idx" ON "Battle"("trackBId");

CREATE TABLE "BattleVote" (
  "id"        TEXT NOT NULL,
  "battleId"  TEXT NOT NULL,
  "fanId"     TEXT NOT NULL,
  -- "A", "B" or "SKIP". A skip counts for nobody; it is kept so the same
  -- battle is not served to that listener again.
  "pick"      TEXT NOT NULL,
  -- True when the listener arrived by a shared link to this battle, so a
  -- win's share of invited votes can always be seen.
  "viaShare"  BOOLEAN NOT NULL DEFAULT false,
  -- The song a listener picks also appears in their Saved list. This is set
  -- when they take it off that list, which leaves the vote itself alone.
  "hiddenAt"  TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BattleVote_pkey" PRIMARY KEY ("id")
);

-- One answer per listener per battle, enforced by the database.
CREATE UNIQUE INDEX "BattleVote_battleId_fanId_key" ON "BattleVote"("battleId", "fanId");
CREATE INDEX "BattleVote_fanId_idx" ON "BattleVote"("fanId");
