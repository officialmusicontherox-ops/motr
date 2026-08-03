-- Records every admin login attempt so repeated failures can be throttled
-- and reviewed. Serverless functions don't share memory, so this has to
-- live in the database rather than in a process-local counter.
CREATE TABLE "AdminLoginAttempt" (
  "id"        TEXT NOT NULL,
  "ip"        TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "success"   BOOLEAN NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminLoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminLoginAttempt_ip_createdAt_idx" ON "AdminLoginAttempt"("ip", "createdAt" DESC);
CREATE INDEX "AdminLoginAttempt_email_createdAt_idx" ON "AdminLoginAttempt"("email", "createdAt" DESC);
CREATE INDEX "AdminLoginAttempt_createdAt_idx" ON "AdminLoginAttempt"("createdAt" DESC);

-- A TOTP code stays valid for its whole time window, so without this the
-- same six digits could be replayed if they were ever observed.
ALTER TABLE "Admin"
  ADD COLUMN "lastTotpCode" TEXT,
  ADD COLUMN "lastTotpAt"   TIMESTAMP(3);
