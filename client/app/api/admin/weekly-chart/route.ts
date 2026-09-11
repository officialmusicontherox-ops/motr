import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { previewWeeklyChart, sendWeeklyChart } from "@/lib/weeklyChart";

/**
 * The weekly chart email: preview and send.
 *
 * GET shows who would receive it and what it would say; POST sends. Mail to
 * every address on the platform is not something that should happen as a side
 * effect of opening a page.
 */
export const maxDuration = 60;

function appUrl(req: NextRequest) {
  return process.env.APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await previewWeeklyChart(appUrl(req)));
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendWeeklyChart(appUrl(req)));
}
