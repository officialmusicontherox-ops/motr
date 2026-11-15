import { NextRequest, NextResponse } from "next/server";
import { getFanSession } from "@/lib/fanAuth";
import { nextBattle } from "@/lib/battles";

/**
 * The listener's next battle.
 *
 * An open battle carries what the Discover card carries, the clip, the
 * title, the cover and the genre, and a sealed ticket. No artist names and
 * no id that could be used to look them up. Those arrive only in answer to
 * a vote.
 *
 * `b` is a battle somebody was sent to by a shared link. It is served first
 * if they can still vote in it, and shown as a result if they already have
 * or if it has closed.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fanId = await getFanSession();
  if (!fanId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // The same switch the swipe feed honours, so somebody who has hidden AI
  // vocals does not meet them here instead.
  const excludeAi = req.nextUrl.searchParams.get("ai") === "0";
  const asked = req.nextUrl.searchParams.get("b");

  const out = await nextBattle(fanId, excludeAi, asked);
  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
