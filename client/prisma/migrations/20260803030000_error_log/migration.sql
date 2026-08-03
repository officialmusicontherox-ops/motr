CREATE TYPE "ErrorSource" AS ENUM ('SERVER', 'CLIENT');

CREATE TABLE "ErrorLog" (
  "id"         TEXT NOT NULL,
  "source"     "ErrorSource" NOT NULL,
  "message"    TEXT NOT NULL,
  -- Errors repeat; we count them against one row instead of writing
  -- thousands, so a single broken page can't bury everything else.
  "fingerprint" TEXT NOT NULL,
  "count"      INTEGER NOT NULL DEFAULT 1,
  "path"       TEXT,
  "method"     TEXT,
  "stack"      TEXT,
  "digest"     TEXT,
  "userAgent"  TEXT,
  "resolved"   BOOLEAN NOT NULL DEFAULT false,
  "firstSeen"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeen"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ErrorLog_fingerprint_key" ON "ErrorLog"("fingerprint");
CREATE INDEX "ErrorLog_resolved_lastSeen_idx" ON "ErrorLog"("resolved", "lastSeen" DESC);
