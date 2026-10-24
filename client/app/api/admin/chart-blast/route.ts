import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { APP_URL } from "@/lib/appUrl";
import { previewChartBlast, sendChartBlast } from "@/lib/chartBlast";

/**
 * This week's charts, on demand.
 *
 * GET shows who it would reach and what it would say; POST sends. Mail to
 * every address on the platform is not something that should happen as a
 * side effect of opening a page.
 */
export const maxDuration = 60;

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await previewChartBlast(APP_URL));
}

export async function POST(_req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendChartBlast(APP_URL));
}
