-- Artists can now receive recurring milestone email, so they need a way out.
ALTER TABLE "Artist" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;
