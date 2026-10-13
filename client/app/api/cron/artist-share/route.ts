import { NextRequest, NextResponse } from "next/server";
import { sendSharePageEmails } from "@/lib/artistSharePage";

/**
 * Tells an artist about their share page once their music is in the feed.
 *
 * This used to be a button somebody had to remember to press, which is why
 * the dashboard kept reporting a pile of artists who had never been told. It
 * is the same shape as every other artist email now: it happens on its own,
 * after a quiet period so one sitting produces one email.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Capped per run so a backlog goes out over a few hours rather than as one
  // burst, which is what a sending domain's reputation prefers.
  const result = await sendSharePageEmails({ limit: 15 });
  return NextResponse.json({ ok: true, ...result });
}
