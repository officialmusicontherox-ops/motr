-- Radio shows could already apply as curators ("Radio show" has always been an
-- outlet type), but there was no way for one to claim a share: airplay isn't a
-- playlist, a video, or a write-up, so a station that played a track had
-- nothing to submit and could never be paid.
--
-- Proof is a link like the others — an archived episode or a published
-- tracklist — and it sits in the hold period, because an archive can be taken
-- down the same way a playlist add can be pulled.

ALTER TYPE "FeatureType" ADD VALUE 'RADIO';
