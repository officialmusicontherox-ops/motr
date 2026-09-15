-- The weekly chart winner, recorded at the time. A chart is a moving window,
-- so the same query next month gives a different answer.
CREATE TABLE "ChartWinner" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "artistId" TEXT,
    "artistName" TEXT NOT NULL,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "writeUpUrl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChartWinner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChartWinner_weekStart_key" ON "ChartWinner"("weekStart");
CREATE INDEX "ChartWinner_weekStart_idx" ON "ChartWinner"("weekStart");
