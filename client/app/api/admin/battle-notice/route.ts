import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { previewBattleNotice, sendBattleNotice } from "@/lib/battleNotice";

/**
 * Tell artists their song is in a battle this week.
 *
 * GET says how many would be written to. POST sends one batch and reports
 * what is left; the button calls it until nothing is.
 */
export const dynamic = "force-dynamic";

const APP = process.env.APP_URL ?? "https://app.musicontherox.com";

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await previewBattleNotice());
}

export async function POST() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await sendBattleNotice(APP));
}
