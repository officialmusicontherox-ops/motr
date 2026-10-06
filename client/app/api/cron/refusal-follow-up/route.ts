import { NextRequest, NextResponse } from "next/server";
import { sendRefusalFollowUps } from "@/lib/refusalFollowUp";

/**
 * Tells artists why a submission failed, a few minutes after it did.
 *
 * Called on a schedule rather than from the submission itself, so the message
 * covers everything one artist got wrong in a sitting instead of arriving
 * once per bad link.
 *
 * Guarded by a shared secret rather than an admin session: the caller is a
 * scheduled function, not a person.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const result = await sendRefusalFollowUps(appUrl);
  return NextResponse.json({ ok: true, ...result });
}
