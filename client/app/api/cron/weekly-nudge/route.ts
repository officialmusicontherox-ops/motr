import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { sendComeBackEmails } from "@/lib/nudges";

/**
 * The come-back email, sent by hand from the dashboard.
 *
 * Deliberately not scheduled. Sending sits with a person who can look at who
 * is due first, which for a list this size is better judgement than a cron
 * would apply — and there's no schedule to quietly stop working.
 *
 * Who receives it is still governed by the rules in lib/nudges.ts, so pressing
 * the button twice in a day mails nobody twice.
 *
 * The CRON_SECRET bearer check is kept so this can be scheduled later without
 * reopening the route; today an admin session is the way in.
 */
async function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;
  return Boolean(await getAdminSession());
}

async function run(req: NextRequest) {
  if (!(await authorised(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl =
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://app.musicontherox.com");

  try {
    const result = await sendComeBackEmails(appUrl);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Nudge run failed" },
      { status: 500 }
    );
  }
}

// Vercel Cron issues a GET; the dashboard button posts.
export const GET = run;
export const POST = run;
