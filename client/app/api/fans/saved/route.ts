import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spotifyLinkFor } from "@/lib/spotifyLink";

// Everything a fan swiped right on, newest first.
export async function GET(req: NextRequest) {
  const fanId = req.nextUrl.searchParams.get("fanId");
  if (!fanId) {
    return NextResponse.json({ error: "fanId query param is required" }, { status: 400 });
  }

  const swipes = await prisma.fanSwipe.findMany({
    where: { fanId, direction: "RIGHT" },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      track: {
        select: {
          id: true,
          title: true,
          artistName: true,
          artworkUrl: true,
          previewUrl: true,
          genre: true,
          status: true,
          fanRightSwipes: true,
          externalId: true,
          source: true,
        },
      },
    },
  });

  return NextResponse.json({
    saved: swipes.map((s) => ({
      ...s.track,
      savedAt: s.createdAt,
      savedToSpotifyAt: s.savedToSpotifyAt,
      // Works for every fan, unlike the API save — see lib/spotifyLink.ts.
      spotifyUrl: spotifyLinkFor(s.track),
    })),
  });
}
