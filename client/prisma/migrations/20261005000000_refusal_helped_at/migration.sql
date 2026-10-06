-- When the artist behind a refused submission was told what to fix.
-- Dismissing a refusal only clears the dashboard; it never reached the artist.
ALTER TABLE "RefusedSubmission" ADD COLUMN "helpedAt" TIMESTAMP(3);
