-- Breaking through is now a ratio over a minimum sample, not a raw count of
-- right-swipes: a track shown to thousands could otherwise crawl to 100
-- approvals on a poor hit rate.
ALTER TABLE "Track" RENAME COLUMN "requiredFanApprovals" TO "requiredFanVotes";
ALTER TABLE "Track" ADD COLUMN "requiredApprovalRate" DOUBLE PRECISION NOT NULL DEFAULT 0.55;
