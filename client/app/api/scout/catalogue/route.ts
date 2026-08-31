import { NextRequest, NextResponse } from "next/server";
import { requireScout } from "@/lib/scoutAuth";
import { scoutCatalogue, scoutSummary, weeklyLeaders } from "@/lib/scoutData";

export async function GET(req: NextRequest) {
  const auth = await requireScout();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const params = req.nextUrl.searchParams;
  const sortParam = params.get("sort");
  const sort =
    sortParam === "saveRate" || sortParam === "swipes" || sortParam === "recent"
      ? sortParam
      : "recent";

  const [tracks, summary, weekly] = await Promise.all([
    scoutCatalogue({ genre: params.get("genre"), sort }),
    scoutSummary(),
    weeklyLeaders(),
  ]);

  return NextResponse.json({ scout: { name: auth.name }, tracks, summary, weekly });
}
