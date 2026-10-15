import { NextRequest } from "next/server";
import { evaluate, fanStats } from "@/lib/achievements";
import { renderAchievementCard } from "@/lib/achievementCard";

/**
 * The image a listener shares.
 *
 * Public, like the artist card, because an image embedded in a post or an
 * email cannot carry credentials. Nothing identifying is drawn on it: the
 * card shows totals and badge names only, never an address or a track list.
 */

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ fanId: string }> }) {
  const { fanId } = await params;
  const stats = await fanStats(fanId);

  // Nothing earned yet is not a card worth posting, and an empty one would
  // say the opposite of what sharing is meant to say.
  const badges = evaluate(stats);
  if (!badges.some((b) => b.earned)) {
    return new Response("Nothing earned yet", { status: 404 });
  }

  return renderAchievementCard({ stats, badges });
}
