import { NextRequest, NextResponse, after } from "next/server";
import { sendBattleResults } from "@/lib/battleResults";
import { sendBattleNotice } from "@/lib/battleNotice";
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

  // After this answer has gone back to the listener: any battle just
  // decided has its artists told the result, and any battle just paired has
  // its artists sent their link. Results first, then announcements with
  // whatever time is left, so the request stays inside its limit.
  after(async () => {
    const started = Date.now();
    await sendBattleResults().catch(() => {});
    const left = 6000 - (Date.now() - started);
    if (left > 1000) {
      await sendBattleNotice("https://app.musicontherox.com", { budgetMs: left, housekeeping: false }).catch(() => {});
    }
  });
  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
