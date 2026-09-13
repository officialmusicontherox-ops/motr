-- Artist-declared use of generative AI. Nullable: false is "they said no",
-- null is "nobody was asked", which covers everything submitted before today.
ALTER TABLE "Track" ADD COLUMN "aiGenerated" BOOLEAN;
