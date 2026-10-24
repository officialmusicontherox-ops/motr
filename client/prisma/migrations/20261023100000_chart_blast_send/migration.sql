-- One record per on-demand chart send, so a second one on the same day can be
-- refused. Kept rather than overwritten: "when did this last go out" is a
-- question worth being able to answer.
CREATE TABLE "ChartBlastSend" (
    "id" TEXT NOT NULL,
    "sentOn" TEXT NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChartBlastSend_pkey" PRIMARY KEY ("id")
);

-- The day is the guard. Unique, so two presses racing cannot both insert.
CREATE UNIQUE INDEX "ChartBlastSend_sentOn_key" ON "ChartBlastSend"("sentOn");
