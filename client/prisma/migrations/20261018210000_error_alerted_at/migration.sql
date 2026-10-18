-- When this fault last sent an email, so the same one is not sent twice.
--
-- Without it the only options are emailing every occurrence, which turns one
-- scanner into eighteen emails and trains you to ignore them, or emailing
-- nothing, which is where we started.
ALTER TABLE "ErrorLog" ADD COLUMN "alertedAt" TIMESTAMP(3);
