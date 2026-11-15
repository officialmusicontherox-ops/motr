-- A battle called off because one of its songs was pulled from MOTR.
--
-- Kept as a row rather than deleted, so the votes already cast and the
-- picks in people's Saved lists still have something to point at. It counts
-- for nobody, and it no longer holds the other artist's place for the week.
ALTER TABLE "Battle" ADD COLUMN "cancelledAt" TIMESTAMP(3);
