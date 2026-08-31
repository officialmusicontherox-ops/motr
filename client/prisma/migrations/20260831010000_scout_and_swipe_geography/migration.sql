-- Where each swipe came from. Nullable because the header may be absent, and
-- because every swipe recorded before today has no origin to give.
ALTER TABLE "FanSwipe" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "FanSwipe" ADD COLUMN "countryName" TEXT;
ALTER TABLE "FanSwipe" ADD COLUMN "region" TEXT;
ALTER TABLE "FanSwipe" ADD COLUMN "city" TEXT;

CREATE TYPE "ScoutStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "Scout" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "status" "ScoutStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusNote" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Scout_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Scout_email_key" ON "Scout"("email");
CREATE INDEX "Scout_status_idx" ON "Scout"("status");

CREATE TABLE "ScoutLoginToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoutLoginToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScoutLoginToken_tokenHash_key" ON "ScoutLoginToken"("tokenHash");
CREATE INDEX "ScoutLoginToken_email_expiresAt_idx" ON "ScoutLoginToken"("email", "expiresAt");
