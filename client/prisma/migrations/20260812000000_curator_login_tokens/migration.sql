-- Sign-in by emailed link, so a curator whose address isn't a Google account
-- can still get in. Two of the first four were in exactly that position.
--
-- Only the hash of each token is stored, so a copy of this table can't be
-- used to sign in as anyone.
CREATE TABLE "CuratorLoginToken" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuratorLoginToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CuratorLoginToken_tokenHash_key" ON "CuratorLoginToken"("tokenHash");
CREATE INDEX "CuratorLoginToken_email_expiresAt_idx" ON "CuratorLoginToken"("email", "expiresAt");
