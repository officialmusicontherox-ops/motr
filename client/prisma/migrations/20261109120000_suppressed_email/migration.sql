-- Addresses that must never be mailed again, whoever they belong to.
--
-- The opt-out flags on Artist and Fan only protect people who have an
-- account. Someone on a cold outreach list who asks to be removed has no row
-- to flag, so the request lived in a spreadsheet and would have been undone
-- by the next export that happened to include them.
CREATE TABLE "SuppressedEmail" (
  "id"        TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "reason"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SuppressedEmail_pkey" PRIMARY KEY ("id")
);

-- Matched case-insensitively, because an address typed into a reply rarely
-- matches the case it arrived in.
CREATE UNIQUE INDEX "SuppressedEmail_email_key" ON "SuppressedEmail"(lower("email"));
