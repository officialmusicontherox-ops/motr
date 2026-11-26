-- Two charts from the week of 22 November 2026: Top Artists and AI Artists,
-- each with its own winner. Existing rows are all the regular chart.
ALTER TABLE "ChartWinner" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'regular';
DROP INDEX "ChartWinner_weekStart_key";
CREATE UNIQUE INDEX "ChartWinner_weekStart_kind_key" ON "ChartWinner"("weekStart", "kind");
