-- A chart send is now made in batches, so it has to survive between them.
--
-- The function that sends has about ten seconds, and the mailing is far
-- larger than that, so the browser asks for one batch at a time. These
-- columns are what carries the send across those requests: the queue is a
-- snapshot of the chart and the addresses taken when the day was claimed, so
-- every batch mails the same chart to the same list even if someone swipes
-- or signs up partway through, and the cursor is how far down that list we
-- have reached.
ALTER TABLE "ChartBlastSend" ADD COLUMN "cursor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChartBlastSend" ADD COLUMN "queue" TEXT;
ALTER TABLE "ChartBlastSend" ADD COLUMN "doneAt" TIMESTAMP(3);
