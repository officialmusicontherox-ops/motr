import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { APP_URL } from "@/lib/appUrl";
import { previewWinnerAnnounce, sendWinnerAnnounce } from "@/lib/winnerAnnounce";

/**
 * The winner announcement, on demand.
 *
 * GET says who would be announced and whether anything is missing; POST
 * sends one batch and reports progress, so the dashboard calls it until it
 * says done. No maxDuration: that is a Vercel setting Netlify ignores, which
 * is why this is batched.
 */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await previewWinnerAnnounce(APP_URL));
}

export async function POST() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendWinnerAnnounce(APP_URL));
}
