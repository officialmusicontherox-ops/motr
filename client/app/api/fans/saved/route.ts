import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        },
      },
    },
  });

  return NextResponse.json({
    saved: swipes.map((s) => ({
      ...s.track,
      savedAt: s.createdAt,
      savedToSpotifyAt: s.savedToSpotifyAt,
    })),
  });
}
