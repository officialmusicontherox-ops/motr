import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spotifyLinkFor } from "@/lib/spotifyLink";

// Everything a fan swiped right on and has not removed, newest first.
export async function GET(req: NextRequest) {
  const fanId = req.nextUrl.searchParams.get("fanId");
  if (!fanId) {
    return NextResponse.json({ error: "fanId query param is required" }, { status: 400 });
  }

  const swipes = await prisma.fanSwipe.findMany({
    where: { fanId, direction: "RIGHT", hiddenAt: null },
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

/**
 * Removes a save from the listener's own list, or clears the list.
 *
 * Hides rather than deletes. The verdict is already counted on the track,
 * already reported to the artist, and may already sit in a locked chart row,
 * so withdrawing it would rewrite history that other things depend on. Keeping
 * the row also keeps the unique constraint on (fanId, trackId) doing its job:
 * a removed track does not come back round in the feed to be swiped twice.
 */
export async function PATCH(req: NextRequest) {
  const { fanId, trackId, all } = await req.json().catch(() => ({}) as Record<string, unknown>);

  if (typeof fanId !== "string" || !fanId) {
    return NextResponse.json({ error: "fanId is required" }, { status: 400 });
  }
  if (all !== true && (typeof trackId !== "string" || !trackId)) {
    return NextResponse.json({ error: "trackId is required unless all is true" }, { status: 400 });
  }

  // Scoped to the caller's own swipes, and only ones still visible, so a
  // repeated request cannot rewrite the time something was removed.
  const { count } = await prisma.fanSwipe.updateMany({
    where: {
      fanId,
      direction: "RIGHT",
      hiddenAt: null,
      ...(all === true ? {} : { trackId: trackId as string }),
    },
    data: { hiddenAt: new Date() },
  });

  return NextResponse.json({ removed: count });
}
