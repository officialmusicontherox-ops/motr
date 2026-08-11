-- 100 votes at 55% was unreachable: at current traffic a track collected
-- ~0.29 votes a day, so breaking through took roughly a year. 75 votes with
-- 25 of them positive is the same shape of test — a real sample, a real
-- share — at a size the audience can actually deliver.
ALTER TABLE "Track" ALTER COLUMN "requiredFanVotes" SET DEFAULT 75;
ALTER TABLE "Track" ALTER COLUMN "requiredApprovalRate" SET DEFAULT 0.33;

UPDATE "Track"
SET "requiredFanVotes" = 75, "requiredApprovalRate" = 0.33
WHERE "status" = 'DISCOVERY';
