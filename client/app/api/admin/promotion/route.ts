import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { artistPromotion } from "@/lib/scoutData";

/**
 * Which artists bring an audience, for the A&R view.
 *
 * Served from the scout data layer rather than a query of its own, because
 * this is meant to reach a scout eventually and a second implementation
 * would be the one that drifts.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 30)));
  return NextResponse.json({ days, artists: await artistPromotion(days) });
}
