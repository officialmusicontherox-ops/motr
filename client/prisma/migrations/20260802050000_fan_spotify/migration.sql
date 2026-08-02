-- AlterTable
ALTER TABLE "Fan"
  ADD COLUMN "spotifyId" TEXT,
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "spotifyAccessToken" TEXT,
  ADD COLUMN "spotifyRefreshToken" TEXT,
  ADD COLUMN "spotifyTokenExpires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Fan_spotifyId_key" ON "Fan"("spotifyId");
