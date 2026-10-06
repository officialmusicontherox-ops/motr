import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyRecaps } from "@/lib/weeklyRecap";

/**
 * The Sunday recap.
 *
 * Called hourly on Sundays rather than once at a fixed UTC time: the send is
 * meant to land at 10am Central, and a fixed UTC hour drifts by one when the
 * clocks change. The library decides whether this is the hour, and the record
 * of who has had which week means an extra call can never send twice.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const force = req.nextUrl.searchParams.get("force") === "1";
  const result = await sendWeeklyRecaps(appUrl, { force });
  return NextResponse.json({ ok: true, ...result });
}
