-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'PAID', 'REJECTED');

-- AlterEnum
BEGIN;
CREATE TYPE "PayoutStatus_new" AS ENUM ('HELD', 'AVAILABLE', 'WITHDRAWN');
ALTER TABLE "public"."CuratorPayout" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CuratorPayout" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING ("status"::text::"PayoutStatus_new");
ALTER TYPE "PayoutStatus" RENAME TO "PayoutStatus_old";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";
DROP TYPE "public"."PayoutStatus_old";
ALTER TABLE "CuratorPayout" ALTER COLUMN "status" SET DEFAULT 'HELD';
COMMIT;

-- AlterTable
ALTER TABLE "CuratorPayout" DROP COLUMN "releasedAt",
ADD COLUMN     "maturesAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "withdrawalId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'HELD';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "payoutDestination" TEXT;

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "payoutDestination" TEXT,
    "adminNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Withdrawal_userId_status_idx" ON "Withdrawal"("userId", "status");

-- CreateIndex
CREATE INDEX "CuratorPayout_userId_status_idx" ON "CuratorPayout"("userId", "status");

-- AddForeignKey
ALTER TABLE "CuratorPayout" ADD CONSTRAINT "CuratorPayout_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

