-- Sign-in links by email for listeners without a Google account.
CREATE TABLE "FanLoginToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FanLoginToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FanLoginToken_tokenHash_key" ON "FanLoginToken"("tokenHash");
CREATE INDEX "FanLoginToken_email_expiresAt_idx" ON "FanLoginToken"("email", "expiresAt");
