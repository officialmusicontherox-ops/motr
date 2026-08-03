-- Curators need to be pausable and suspendable without deleting the row:
-- earnings, payouts and past assignments all reference it.
CREATE TYPE "CuratorStatus" AS ENUM ('ACTIVE', 'PAUSED', 'SUSPENDED', 'REMOVED');

ALTER TABLE "User"
  ADD COLUMN "status" "CuratorStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "statusNote" TEXT,
  ADD COLUMN "statusChangedAt" TIMESTAMP(3);

CREATE INDEX "User_status_idx" ON "User"("status");
