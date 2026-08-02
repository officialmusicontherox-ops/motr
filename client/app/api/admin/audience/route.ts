import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

/**
 * Who's actually using the feed, split by how they got in.
 *
 * A Spotify fan is one we can act on behalf of — push saves into their
 * library, reach them again. An anonymous fan is a swipe count and nothing
 * more, so the two are worth watching separately rather than as one "fans"
 * number.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") === "anonymous" ? "anonymous" : "spotify";
  const spotifyFilter = type === "spotify" ? { NOT: { spotifyId: null } } : { spotifyId: null };

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [spotifyCount, anonCount, activeSpotify, activeAnon, savedToLibrary, fans] =
    await Promise.all([
      prisma.fan.count({ where: { NOT: { spotifyId: null } } }),
      prisma.fan.count({ where: { spotifyId: null } }),
      prisma.fan.count({
        where: { NOT: { spotifyId: null }, swipes: { some: { createdAt: { gte: weekAgo } } } },
      }),
      prisma.fan.count({
        where: { spotifyId: null, swipes: { some: { createdAt: { gte: weekAgo } } } },
      }),
      prisma.fanSwipe.count({ where: { NOT: { savedToSpotifyAt: null } } }),
      prisma.fan.findMany({
        where: spotifyFilter,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          username: true,
          displayName: true,
          createdAt: true,
          // The token itself never leaves the server — the dashboard only
          // needs to know whether the connection is still usable.
          spotifyRefreshToken: true,
          _count: { select: { swipes: true } },
        },
      }),
    ]);

  return NextResponse.json({
    totals: {
      spotify: spotifyCount,
      anonymous: anonCount,
      activeSpotify,
      activeAnon,
      savedToLibrary,
    },
    fans: fans.map((f) => ({
      id: f.id,
      username: f.username,
      displayName: f.displayName,
      createdAt: f.createdAt,
      swipes: f._count.swipes,
      connected: Boolean(f.spotifyRefreshToken),
    })),
  });
}
