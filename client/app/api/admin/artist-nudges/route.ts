import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { previewArtistNudges, sendArtistNudges } from "@/lib/artistNudges";

/**
 * "Send us more music" — preview and send.
 *
 * Also reachable by the scheduler with the CRON_SECRET bearer token, so the
 * same logic serves both the button and the weekly run rather than drifting
 * into two versions.
 */
export const maxDuration = 60;

async function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;
  return Boolean(await getAdminSession());
}

export async function GET(req: NextRequest) {
  if (!(await authorised(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await previewArtistNudges());
}

export async function POST(req: NextRequest) {
  if (!(await authorised(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return NextResponse.json(await sendArtistNudges(appUrl));
}
