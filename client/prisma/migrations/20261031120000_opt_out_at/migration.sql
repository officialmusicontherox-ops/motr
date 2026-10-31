-- When someone opted out, not just that they did.
--
-- The flag on its own cannot answer "who unsubscribed this week", which is
-- what the dashboard needs in order to show them at all. Existing opt-outs
-- keep a null date: they happened before this was recorded, and inventing a
-- timestamp for them would put them at the top of a list of recent news.
ALTER TABLE "Artist" ADD COLUMN "emailOptOutAt" TIMESTAMP(3);
ALTER TABLE "Fan"    ADD COLUMN "emailOptOutAt" TIMESTAMP(3);

-- Who asked, when it is not the person themselves clicking the link.
ALTER TABLE "Artist" ADD COLUMN "emailOptOutBy" TEXT;
ALTER TABLE "Fan"    ADD COLUMN "emailOptOutBy" TEXT;

-- An artist who unsubscribes has their music pulled with them, and this says
-- that is why. Rejected-on-merit and pulled-for-opt-out both read as REJECTED
-- otherwise, so putting someone back on the list could not tell them apart.
ALTER TABLE "Track" ADD COLUMN "removedForOptOut" BOOLEAN NOT NULL DEFAULT false;
