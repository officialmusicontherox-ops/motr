import { NextRequest } from "next/server";
import { badgeRarity, evaluate, fanStats } from "@/lib/achievements";
import { renderAchievementCard } from "@/lib/achievementCard";

/**
 * The story graphic for one badge.
 *
 * Public, like the artist card, because an image in a post cannot carry
 * credentials. Nothing identifying is drawn on it: the badge name, what earns
 * it, and how rare it is. The fan id in the path only decides whether that
 * badge has actually been earned, so nobody can post one they do not hold.
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ fanId: string }> }) {
  const { fanId } = await params;
  const wanted = req.nextUrl.searchParams.get("badge");

  const [stats, rarity] = await Promise.all([fanStats(fanId), badgeRarity()]);
  const earned = evaluate(stats).filter((b) => b.earned);
  if (!earned.length) return new Response("Nothing earned yet", { status: 404 });

  // The one asked for, or the hardest one held when nothing is named.
  const badge = (wanted && earned.find((b) => b.id === wanted)) ||
    [...earned].sort((a, b) => b.need - a.need)[0];

  const shape = req.nextUrl.searchParams.get("shape") === "og" ? "og" : "story";
  return renderAchievementCard({ badge, heldBy: rarity[badge.id] ?? null, shape });
}
