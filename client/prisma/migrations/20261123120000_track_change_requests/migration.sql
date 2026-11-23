-- An artist asking to change a song's genre or AI-vocals label. Nothing on
-- the song changes until the admin approves it.
CREATE TABLE "TrackChangeRequest" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "genre" TEXT,
    "aiGenerated" BOOLEAN,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "TrackChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrackChangeRequest_status_idx" ON "TrackChangeRequest"("status");
CREATE INDEX "TrackChangeRequest_trackId_idx" ON "TrackChangeRequest"("trackId");
