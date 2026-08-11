import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { sendWeeklyNudges } from "@/lib/nudges";

/**
 * The weekly come-back email.
 *
 * Runs on a schedule via Vercel Cron, and can also be fired by hand from the
 * admin dashboard — useful for seeing exactly what goes out before trusting a
 * schedule with it.
 *
 * Two ways in, both closed to the public: Vercel sends the CRON_SECRET as a
 * bearer token, and an admin session is accepted so the dashboard button
 * doesn't need a secret in the browser.
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
    const result = await sendWeeklyNudges(appUrl);
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
