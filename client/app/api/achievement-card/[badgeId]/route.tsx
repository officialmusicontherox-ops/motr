import { NextRequest } from "next/server";
import { BADGES } from "@/lib/achievements";
import { renderAchievementCard } from "@/lib/achievementCard";

/**
 * The graphic for one badge. One image per badge, the same for everyone.
 *
 * Deliberately knows nothing about who earned it. An earlier version keyed
 * this on the listener's id so it could print how rare the badge was, which
 * meant their id travelled inside every link they posted — and that id is
 * enough to read their saved list. A graphic that says what a badge is needs
 * no idea who is holding it.
 */

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ badgeId: string }> }) {
  const { badgeId } = await params;
  const badge = BADGES.find((b) => b.id === badgeId);
  if (!badge) return new Response("No such badge", { status: 404 });

  return renderAchievementCard({ badge });
}
