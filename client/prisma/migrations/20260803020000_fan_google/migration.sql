-- Fans can now sign in with Google, so swipes and saves survive a cleared
-- browser or a second device without needing a Spotify account.
ALTER TABLE "Fan"
  ADD COLUMN "googleId" TEXT,
  ADD COLUMN "email" TEXT;

CREATE UNIQUE INDEX "Fan_googleId_key" ON "Fan"("googleId");
CREATE UNIQUE INDEX "Fan_email_key" ON "Fan"("email");
