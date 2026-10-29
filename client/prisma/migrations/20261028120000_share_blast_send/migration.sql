-- The mass share-card send, batched.
--
-- Same shape as ChartBlastSend and for the same reason: the function has
-- about ten seconds, every email carries a freshly drawn card, and the list
-- is every artist on the platform. The queue is the snapshot taken when the
-- day was claimed and the cursor is how far down it we have reached, so the
-- send survives between requests and resumes rather than starting over.
CREATE TABLE "ShareBlastSend" (
  "id"         TEXT NOT NULL,
  "sentOn"     TEXT NOT NULL,
  "recipients" INTEGER NOT NULL DEFAULT 0,
  "sent"       INTEGER NOT NULL DEFAULT 0,
  "failed"     INTEGER NOT NULL DEFAULT 0,
  "cursor"     INTEGER NOT NULL DEFAULT 0,
  "queue"      TEXT,
  "sentAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "doneAt"     TIMESTAMP(3),
  CONSTRAINT "ShareBlastSend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShareBlastSend_sentOn_key" ON "ShareBlastSend"("sentOn");
