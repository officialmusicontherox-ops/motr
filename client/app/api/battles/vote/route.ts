import { NextRequest, NextResponse } from "next/server";
import { getFanSession } from "@/lib/fanAuth";
import { BattleGoneError, decideBattle } from "@/lib/battles";

/**
 * Answer a battle: A, B, or skip.
 *
 * The voter is whoever holds the session, never whoever the body names, and
 * a battle can only be answered by the listener it was served to. A vote
 * returns the reveal. A skip returns nothing, because the reveal is what a
 * vote earns.
 */
export async function POST(req: NextRequest) {
  const fanId = await getFanSession();
  if (!fanId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { battleId, pick } = await req.json().catch(() => ({}));
  if (typeof battleId !== "string" || (pick !== "A" && pick !== "B" && pick !== "SKIP")) {
    return NextResponse.json({ error: "battleId and pick (A, B or SKIP) are required" }, { status: 400 });
  }

  try {
    const reveal = await decideBattle(fanId, battleId, pick);
    return NextResponse.json({ reveal });
  } catch (e) {
    if (e instanceof BattleGoneError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}
