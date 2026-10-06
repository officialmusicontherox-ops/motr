-- One weekly recap per artist per week, so a retried run cannot mail twice.
CREATE TABLE "WeeklyRecapSend" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "position" INTEGER,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyRecapSend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyRecapSend_artistId_weekStart_key" ON "WeeklyRecapSend"("artistId", "weekStart");
CREATE INDEX "WeeklyRecapSend_weekStart_idx" ON "WeeklyRecapSend"("weekStart");
