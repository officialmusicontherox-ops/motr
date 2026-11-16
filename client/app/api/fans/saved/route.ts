import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listenLinkFor } from "@/lib/spotifyLink";
import { getFanSession } from "@/lib/fanAuth";
import { battlePicksFor, hideBattlePicks } from "@/lib/battles";

// Everything a fan swiped right on and has not removed, newest first.
export async function GET() {
  // From the cookie, never from the query string. A fan id is not a secret:
  // it has travelled in sign-in redirects, in browser history and in logs.
  // Reading it from the caller meant anyone who had seen one could read that
  // person's listening history.
  const fanId = await getFanSession();
  if (!fanId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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
          appleTrackId: true,
          // For the artist sheet in Saved. Null for the seeded catalogue,
          // which has no artist record and therefore no profile to show.
          artistId: true,
        },
      },
    },
  });

  const saved = swipes.map((s) => ({
    ...s.track,
    savedAt: s.createdAt,
    savedToSpotifyAt: s.savedToSpotifyAt,
    // Works for every fan, unlike the API save — see lib/spotifyLink.ts.
    ...listenLinkFor(s.track),
  }));

  // Songs picked in battles belong in the library too. They are listed
  // from the votes and are not swipes, so they sit here without counting
  // as a save on any chart. A song that was also swiped right appears once.
  const have = new Set(saved.map((s) => s.id));
  const picks = (await battlePicksFor(fanId)).filter((p) => !have.has(p.trackId));
  if (picks.length > 0) {
    const tracks = await prisma.track.findMany({
      where: { id: { in: picks.map((p) => p.trackId) } },
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
        appleTrackId: true,
        artistId: true,
      },
    });
    const byId = new Map(tracks.map((t) => [t.id, t]));
    const seen = new Set<string>();
    for (const p of picks) {
      const t = byId.get(p.trackId);
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      saved.push({ ...t, savedAt: p.at, savedToSpotifyAt: null, ...listenLinkFor(t) });
    }
    saved.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }

  return NextResponse.json({ saved });
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
  const fanId = await getFanSession();
  if (!fanId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { trackId, all } = await req.json().catch(() => ({}) as Record<string, unknown>);

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

  // The same song, or everything, where it got here by a battle pick.
  const picks = await hideBattlePicks(fanId, all === true ? undefined : (trackId as string));

  return NextResponse.json({ removed: count + picks });
}
