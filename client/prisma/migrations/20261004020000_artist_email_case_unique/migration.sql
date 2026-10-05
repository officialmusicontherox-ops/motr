-- One artist per address, whatever the capitalisation.
--
-- "Artist"."email" was already unique, but Postgres compares it byte for
-- byte, so Darwilli33@gmail.com and darwilli33@gmail.com were two different
-- artists. Two people submitted with a stray capital and had their catalogue
-- split across two records, each showing only half their tracks.
--
-- The application lower-cases on the way in; this makes it impossible even if
-- some future path forgets to.
CREATE UNIQUE INDEX "Artist_email_lower_key" ON "Artist" (lower("email"));
