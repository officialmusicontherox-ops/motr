-- AlterTable
ALTER TABLE "Withdrawal"
  ADD COLUMN "feeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "netCents" INTEGER;
