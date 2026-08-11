-- A submission the lookup refused. Previously these vanished: the artist saw
-- an error, an email went out, and nothing was left to act on.
CREATE TYPE "RefusedStatus" AS ENUM ('PENDING', 'ADDED', 'DISMISSED');

CREATE TABLE "RefusedSubmission" (
  "id"          TEXT NOT NULL,
  "spotifyUrl"  TEXT NOT NULL,
  "artistEmail" TEXT NOT NULL,
  "genre"       TEXT,
  "reason"      TEXT NOT NULL,
  "attempts"    INTEGER NOT NULL DEFAULT 1,
  "status"      "RefusedStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefusedSubmission_pkey" PRIMARY KEY ("id")
);

-- Retrying the same link shouldn't pile up rows; it bumps the attempt count.
CREATE UNIQUE INDEX "RefusedSubmission_spotifyUrl_artistEmail_key"
  ON "RefusedSubmission"("spotifyUrl", "artistEmail");
CREATE INDEX "RefusedSubmission_status_createdAt_idx"
  ON "RefusedSubmission"("status", "createdAt" DESC);
