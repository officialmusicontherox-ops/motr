-- Come-back email state for artists, mirroring the fan fields.
ALTER TABLE "Artist" ADD COLUMN "lastNudgeAt" TIMESTAMP(3);
ALTER TABLE "Artist" ADD COLUMN "nudgeCount" INTEGER NOT NULL DEFAULT 0;
