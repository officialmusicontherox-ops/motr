import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { SLOTS } from "@/lib/spotlightBundles";

/**
 * Who bought Spotlights, and who they spent them on.
 *
 * Stripe cannot answer this. Its dashboard shows a $5 charge next to the
 * $4 and $15 submission fees from the WordPress site, with no way to tell
 * which is which or who the Spotlight was for.
 */
export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const now = new Date();

  const [purchases, spends, live, queued, totals] = await Promise.all([
    prisma.spotlightPurchase.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.spotlight.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        fanId: true,
        createdAt: true,
        startsAt: true,
        endsAt: true,
        artist: { select: { id: true, name: true } },
        trackId: true,
      },
    }),
    prisma.spotlight.count({ where: { startsAt: { lte: now }, endsAt: { gt: now } } }),
    prisma.spotlight.count({ where: { startsAt: null } }),
    prisma.spotlightPurchase.aggregate({ _sum: { cents: true, credits: true }, _count: true }),
  ]);

  // Who the buyers are, and what they are still holding.
  const fanIds = [
    ...new Set([...purchases.map((p) => p.fanId), ...spends.map((s) => s.fanId ?? "")]),
  ].filter(Boolean);
  const fans = await prisma.fan.findMany({
    where: { id: { in: fanIds } },
    select: { id: true, username: true, spotlightCredits: true },
  });
  const byFan = new Map(fans.map((f) => [f.id, f]));

  // The track that was playing when it was spent, where there was one.
  const trackIds = [...new Set(spends.map((s) => s.trackId).filter(Boolean))] as string[];
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
    select: { id: true, title: true },
  });
  const byTrack = new Map(tracks.map((t) => [t.id, t.title]));

  return NextResponse.json({
    slots: SLOTS,
    live,
    queued,
    totals: {
      purchases: totals._count,
      credits: totals._sum.credits ?? 0,
      cents: totals._sum.cents ?? 0,
    },
    purchases: purchases.map((p) => ({
      id: p.id,
      at: p.createdAt,
      credits: p.credits,
      cents: p.cents,
      sessionId: p.sessionId,
      buyer: byFan.get(p.fanId)?.username ?? "(gone)",
      buyerId: p.fanId,
      holding: byFan.get(p.fanId)?.spotlightCredits ?? 0,
    })),
    spends: spends.map((s) => ({
      id: s.id,
      at: s.createdAt,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      artist: s.artist.name,
      artistId: s.artist.id,
      track: s.trackId ? (byTrack.get(s.trackId) ?? null) : null,
      buyer: s.fanId ? (byFan.get(s.fanId)?.username ?? "(gone)") : "placed by hand",
      buyerId: s.fanId,
    })),
  });
}
