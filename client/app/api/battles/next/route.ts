import { NextRequest, NextResponse } from "next/server";
import { getFanSession } from "@/lib/fanAuth";
import { nextBattle } from "@/lib/battles";

/**
 * The listener's next battle.
 *
 * Returns two preview clips and nothing else: no titles, no names, no
 * artwork and no track ids. What the browser is never sent it cannot leak,
 * and the names arrive only in answer to a vote.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fanId = await getFanSession();
  if (!fanId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // The same switch the swipe feed honours, so somebody who has hidden AI
  // vocals does not meet them here instead.
  const excludeAi = req.nextUrl.searchParams.get("ai") === "0";

  const battle = await nextBattle(fanId, excludeAi);
  return NextResponse.json({ battle }, { headers: { "cache-control": "no-store" } });
}
