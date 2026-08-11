-- Only the admin login was rate limited. Every other public endpoint was
-- open, including the one that adds tracks to the feed and emails the
-- operator, and the one that creates anonymous listeners — which is the
-- cheapest route to manufacturing votes on a platform whose entire claim is
-- that the vote can't be bought.
CREATE TABLE "RequestHit" (
  "id" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestHit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RequestHit_bucket_createdAt_idx" ON "RequestHit"("bucket", "createdAt");
