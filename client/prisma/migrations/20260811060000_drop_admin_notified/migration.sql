-- Reverted. Batching within one submission already sends a single email;
-- separate submissions getting separate emails is the wanted behaviour, so
-- there is nothing for this column to do.
ALTER TABLE "Track" DROP COLUMN IF EXISTS "adminNotifiedAt";
