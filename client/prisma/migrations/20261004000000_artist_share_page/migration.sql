-- How many people opened a track from its artist's own share link.
ALTER TABLE "Track" ADD COLUMN "shareOpens" INTEGER NOT NULL DEFAULT 0;

-- One-click sign-in links for an artist's own page.
CREATE TABLE "ArtistLoginToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistLoginToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArtistLoginToken_tokenHash_key" ON "ArtistLoginToken"("tokenHash");

CREATE INDEX "ArtistLoginToken_email_expiresAt_idx" ON "ArtistLoginToken"("email", "expiresAt");
