import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

/**
 * Who's actually using the feed, split by how they got in.
 *
 * A signed-in fan has a durable account — their saves survive a cleared
 * browser and follow them to another device, and we have an address to
 * reach them at. An anonymous fan is a swipe count and nothing more, so the
 * two are worth watching separately rather than as one "fans" number.
 *
 * Spotify used to be the split; it's Google now, because Spotify's API
 * only ever allowed five accounts. See lib/spotifyLink.ts.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") === "anonymous" ? "anonymous" : "google";
  const filter = type === "google" ? { NOT: { email: null } } : { email: null };

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [googleCount, anonCount, activeGoogle, activeAnon, savedTotal, swipedEver, fans] =
    await Promise.all([
      prisma.fan.count({ where: { NOT: { email: null } } }),
      prisma.fan.count({ where: { email: null } }),
      prisma.fan.count({
        where: { NOT: { email: null }, swipes: { some: { createdAt: { gte: weekAgo } } } },
      }),
      prisma.fan.count({
        where: { email: null, swipes: { some: { createdAt: { gte: weekAgo } } } },
      }),
      prisma.fanSwipe.count({ where: { direction: "RIGHT" } }),
      // The honest headcount. A share link creates a listener the moment
      // someone clicks, so the raw total includes bounces and link
      // previewers who never heard a note.
      prisma.fan.count({ where: { swipes: { some: {} } } }),
      prisma.fan.findMany({
        where: filter,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          createdAt: true,
          _count: { select: { swipes: true } },
        },
      }),
    ]);

  return NextResponse.json({
    totals: {
      google: googleCount,
      anonymous: anonCount,
      activeGoogle,
      activeAnon,
      savedTotal,
      swipedEver,
      registered: googleCount + anonCount,
    },
    fans: fans.map((f) => ({
      id: f.id,
      username: f.username,
      displayName: f.displayName,
      email: f.email,
      createdAt: f.createdAt,
      swipes: f._count.swipes,
    })),
  });
}
