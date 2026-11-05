import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { APP_URL } from "@/lib/appUrl";
import { previewChartBlast, sendChartBlast, type ChartVariant } from "@/lib/chartBlast";

/** "midweek" or anything else, which means the weekly one. */
function variantOf(req: NextRequest): ChartVariant {
  return req.nextUrl.searchParams.get("variant") === "midweek" ? "midweek" : "weekly";
}

/**
 * This week's charts, on demand.
 *
 * GET shows who it would reach and what it would say; POST sends one batch
 * and reports how far along the send is, so the dashboard calls it until it
 * says done. Mail to every address on the platform is not something that
 * should happen as a side effect of opening a page.
 *
 * No maxDuration here on purpose. That is a Vercel setting and Netlify pays
 * no attention to it: this function gets about ten seconds whatever it says,
 * which is why the send is batched rather than run in one request.
 */

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await previewChartBlast(APP_URL, variantOf(req)));
}

export async function POST(_req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendChartBlast(APP_URL));
}
