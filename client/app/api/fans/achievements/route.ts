import { NextResponse } from "next/server";
import { badgeRarity, evaluate, fanStats } from "@/lib/achievements";
import { getFanSession } from "@/lib/fanAuth";

/**
 * What a listener has earned, and what they are closest to.
 *
 * Computed from their swipes on every request rather than stored, so a
 * retuned threshold takes effect immediately and nothing can drift out of
 * step with the swipes it was derived from.
 */
export async function GET() {
  // The cookie, not the caller. See the note in /api/fans/saved.
  const fanId = await getFanSession();
  if (!fanId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [stats, rarity] = await Promise.all([fanStats(fanId), badgeRarity()]);
  // How many other listeners hold it. A badge that says nothing about how
  // hard it was is a tick in a box; "4% of listeners" is the part that makes
  // it worth having.
  const badges = evaluate(stats).map((b) => ({ ...b, heldBy: rarity[b.id] ?? null }));

  // The nearest unearned badge, measured by how much is left rather than by
  // how large the target is: "two more full listens" is the thing that pulls,
  // and a list of everything locked is just a wall.
  const next =
    badges
      .filter((b) => !b.earned)
      .sort((a, b) => a.need - a.have - (b.need - b.have))[0] ?? null;

  return NextResponse.json({ stats, badges, next });
}
