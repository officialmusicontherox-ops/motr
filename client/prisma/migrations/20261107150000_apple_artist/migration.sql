-- The artist's own profile on Apple Music, per track.
--
-- Who a track belongs to was being read two bad ways: from the account that
-- submitted it, which is wrong because a manager or label posts several
-- artists, and from the credited string, which cannot be split reliably
-- because "Earth, Wind & Fire" is one artist and "Luis Martelo, Badoxa" is
-- two. Apple already answers this: it names the primary artist on its own,
-- gives them a stable id, and puts collaborators in the track title.
ALTER TABLE "Track" ADD COLUMN "appleArtistId" TEXT;
ALTER TABLE "Track" ADD COLUMN "appleArtistName" TEXT;
CREATE INDEX "Track_appleArtistId_idx" ON "Track"("appleArtistId");
