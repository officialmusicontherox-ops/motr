-- A curator passing is a legitimate outcome, but "no" with no reason tells
-- the artist nothing and reads as a rejection they can't learn from.
ALTER TABLE "CuratorAssignment" ADD COLUMN "passReason" TEXT;
