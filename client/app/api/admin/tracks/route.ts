import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { GENRES } from "@/lib/genres";
import {
  TrackLookupError,
  appleArtistCatalogue,
  resolveSpotifyTrack,
  titleMatches,
} from "@/lib/trackLookup";
import { parseSpotifyTrackId } from "@/lib/spotifyUrl";

/**
 * Every track on the platform, so a bad one can be pulled quickly — wrong
 * audio, a mis-tagged genre, something a rights holder objects to, or a
 * submission that shouldn't have gone live.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const view = req.nextUrl.searchParams.get("view") ?? "live";
  const q = req.nextUrl.searchParams.get("q")?.trim();

  // Sorting matters for answering "is this artist's track on there?" and for
  // spotting what arrived since you last looked.
  const SORTS = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    title: { title: "asc" },
    artist: { artistName: "asc" },
    popular: { fanRightSwipes: "desc" },
  } as const;
  const sortKey = (req.nextUrl.searchParams.get("sort") ?? "newest") as keyof typeof SORTS;
  const orderBy = SORTS[sortKey] ?? SORTS.newest;

  const where: Record<string, unknown> = {};
  if (view === "live") where.status = "DISCOVERY";
  else if (view === "pulled") where.status = "REJECTED";
  else if (view === "submitted") where.NOT = { artistId: null };
  else if (view === "curators") where.status = { in: ["VETTING", "GRADUATED"] };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { artistName: { contains: q, mode: "insensitive" } },
    ];
  }

  const tracks = await prisma.track.findMany({
    where,
    orderBy,
    take: 200,
    include: {
      artist: { select: { name: true, email: true } },
      _count: { select: { fanSwipes: true, assignments: true } },
    },
  });

  const trackIds = tracks.map((t) => t.id);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // A&R signal. How long someone listened before deciding separates "looked
  // interesting" from "held me", and it's the thing streaming numbers can't
  // tell you because they only count plays that already happened.
  const [listenStats, heldStats, recentVotes] = await Promise.all([
    prisma.fanSwipe.groupBy({
      by: ["trackId"],
      where: { trackId: { in: trackIds }, NOT: { listenMs: null } },
      _avg: { listenMs: true },
      _count: { _all: true },
    }),
    // Right-swipes that came after most of the clip had played.
    prisma.fanSwipe.groupBy({
      by: ["trackId"],
      where: { trackId: { in: trackIds }, direction: "RIGHT", listenMs: { gte: 20_000 } },
      _count: { _all: true },
    }),
    prisma.fanSwipe.groupBy({
      by: ["trackId"],
      where: { trackId: { in: trackIds }, createdAt: { gte: weekAgo } },
      _count: { _all: true },
    }),
  ]);

  const avgListen = new Map(listenStats.map((r) => [r.trackId, r._avg.listenMs]));
  const measured = new Map(listenStats.map((r) => [r.trackId, r._count._all]));
  const heldToEnd = new Map(heldStats.map((r) => [r.trackId, r._count._all]));
  const thisWeek = new Map(recentVotes.map((r) => [r.trackId, r._count._all]));

  const [live, pulled, submitted, withCurators] = await Promise.all([
    prisma.track.count({ where: { status: "DISCOVERY" } }),
    prisma.track.count({ where: { status: "REJECTED" } }),
    prisma.track.count({ where: { NOT: { artistId: null } } }),
    prisma.track.count({ where: { status: { in: ["VETTING", "GRADUATED"] } } }),
  ]);

  return NextResponse.json({
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName: t.artistName,
      albumName: t.albumName,
      artworkUrl: t.artworkUrl,
      previewUrl: t.previewUrl,
      genre: t.genre,
      status: t.status,
      feeStatus: t.feeStatus,
      reviewStatus: t.reviewStatus,
      fanRightSwipes: t.fanRightSwipes,
      fanLeftSwipes: t.fanLeftSwipes,
      // What the breakthrough gate actually reads — full listens count twice,
      // so this runs ahead of the headcount and is the number that matters
      // when you're asking "how close is this?".
      weightedRightVotes: t.weightedRightVotes,
      weightedTotalVotes: t.weightedTotalVotes,
      requiredFanVotes: t.requiredFanVotes,
      requiredApprovalRate: t.requiredApprovalRate,
      addedAt: t.createdAt,
      // No artist means it's catalogue we seeded, not a paid submission.
      submittedBy: t.artist ? { name: t.artist.name, email: t.artist.email } : null,
      swipes: t._count.fanSwipes,
      curatorsAssigned: t._count.assignments,
      previewSource: t.previewUrl.includes("apple")
        ? "iTunes"
        : t.previewUrl.includes("dzcdn")
          ? "Deezer"
          : "Other",
      // Deezer signs its links and they expire within about a day; Apple's
      // are permanent. Worth flagging, since a track can look fine today.
      previewExpires: t.previewUrl.includes("dzcdn"),

      // Null until enough swipes carry a measured listen time.
      avgListenMs: Math.round(avgListen.get(t.id) ?? 0) || null,
      measuredSwipes: measured.get(t.id) ?? 0,
      // Of everyone who liked it, how many stayed for most of the clip.
      convictionRate:
        t.fanRightSwipes > 0 ? (heldToEnd.get(t.id) ?? 0) / t.fanRightSwipes : null,
      votesThisWeek: thisWeek.get(t.id) ?? 0,
    })),
    counts: { live, pulled, submitted, withCurators },
  });
}

/**
 * Pulls a track out of rotation, or puts it back.
 *
 * Uses the REJECTED status rather than deleting the row: swipes, assignments
 * and payments reference it, and a deleted track would take a fan's saved
 * list and an artist's payment record with it.
 */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { trackId, action, note, genre, previewUrl, aiGenerated } = await req
    .json()
    .catch(() => ({}));

  // Correcting a genre matters as much as removing a track: routing is by
  // genre, so a country song filed under R&B reaches five curators who
  // can't use it.
  if (action === "SET_GENRE") {
    if (!trackId || typeof genre !== "string" || !(GENRES as readonly string[]).includes(genre)) {
      return NextResponse.json({ error: "trackId and a valid genre are required" }, { status: 400 });
    }
    const updated = await prisma.track.update({ where: { id: trackId }, data: { genre } });
    return NextResponse.json({ track: { id: updated.id, genre: updated.genre } });
  }

  /**
   * Label a track as AI, or clear the label.
   *
   * The question only reaches artists submitting from now on, which leaves
   * every track already in the feed unasked — and the operator knows most of
   * them personally. Three states, not two: true, false, and null for "still
   * don't know", because a filter that quietly recategorises unknowns as
   * clean is a filter that lies.
   */
  if (action === "SET_AI") {
    if (!trackId) {
      return NextResponse.json({ error: "trackId is required" }, { status: 400 });
    }
    const value = aiGenerated === true ? true : aiGenerated === false ? false : null;
    const updated = await prisma.track.update({
      where: { id: trackId },
      data: { aiGenerated: value },
    });
    return NextResponse.json({ track: { id: updated.id, aiGenerated: updated.aiGenerated } });
  }

  /**
   * Repoint a track at the right audio by hand.
   *
   * Three kinds of link are accepted:
   *  - a **Spotify** track link, which re-resolves everything — title,
   *    artist, artwork and audio — through the same verified path a
   *    submission takes. This is the one to use when a track was matched to
   *    the wrong recording.
   *  - an **Apple Music** page link, from which the preview is looked up.
   *  - a **direct audio** link.
   *
   * Whatever is given, it is played before being stored: saving a link that
   * doesn't work would reproduce the failure this exists to fix.
   */
  if (action === "SET_PREVIEW") {
    const raw = typeof previewUrl === "string" ? previewUrl.trim() : "";
    if (!trackId || !raw) {
      return NextResponse.json({ error: "trackId and a link are required" }, { status: 400 });
    }

    // Spotify link: re-resolve the whole track, verified against its artist.
    const spotifyId = parseSpotifyTrackId(raw);
    if (spotifyId) {
      try {
        const r = await resolveSpotifyTrack(spotifyId);
        const updated = await prisma.track.update({
          where: { id: trackId },
          data: {
            externalId: spotifyId,
            title: r.title,
            artistName: r.artistName,
            albumName: r.albumName,
            artworkUrl: r.artworkUrl,
            previewUrl: r.previewUrl,
            durationMs: r.durationMs,
            // This route matched artist and title, unlike the pasted-audio
            // branch below, so it goes back through the health check on its
            // own merits rather than being taken on trust.
            audioVerdict: null,
            audioCheckedAt: null,
          },
        });
        return NextResponse.json({
          track: { id: updated.id, title: updated.title, artistName: updated.artistName },
          via: "spotify",
        });
      } catch (e) {
        return NextResponse.json(
          {
            error:
              e instanceof TrackLookupError
                ? e.message
                : "Couldn't resolve that Spotify link.",
          },
          { status: 400 }
        );
      }
    }

    let resolved = raw;

    // Apple carries the track id in ?i= on an album URL, or as the last path
    // segment of a /song/ URL. Both music.apple.com and the older
    // itunes.apple.com form use the same shapes. A bare id is accepted too,
    // since that is what people paste when copying from a search result.
    const appleId =
      raw.match(/[?&]i=(\d+)/)?.[1] ??
      raw.match(/\/song\/[^/]*\/(\d+)/)?.[1] ??
      (/^\d{6,}$/.test(raw) ? raw : undefined);
    // An album link with no ?i= names a release, not a recording. Pasting one
    // used to store the web page itself as the preview, which plays nothing:
    // two tracks sat in the feed silent, one of them through four swipes. The
    // album's songs are read instead and matched against this track's title.
    const albumId = appleId ? undefined : raw.match(/\/album\/[^/]*\/(\d+)/)?.[1];

    // Apple ids are per storefront, and lookup defaults to the US one. A
    // Canadian release pasted as music.apple.com/ca/... returns nothing at all
    // from the US store, which reads as "Apple has never heard of it".
    const storefront = raw.match(/music\.apple\.com\/([a-z]{2})\//i)?.[1]?.toLowerCase();
    const country = storefront ? `&country=${storefront}` : "";

    if (appleId) {
      const look = await fetch(`https://itunes.apple.com/lookup?id=${appleId}${country}`);
      const data = look.ok ? await look.json() : null;
      const hit = data?.results?.[0];
      if (!hit?.previewUrl) {
        return NextResponse.json(
          { error: "That Apple link has no preview available." },
          { status: 400 }
        );
      }
      resolved = hit.previewUrl;
    } else if (albumId) {
      const current = await prisma.track.findUnique({
        where: { id: trackId },
        select: { title: true, artistName: true },
      });
      if (!current) {
        return NextResponse.json({ error: "That track no longer exists." }, { status: 404 });
      }

      // Not by reading the album: Apple's album-to-songs expansion returns
      // nothing at all for some singles, including the one that caused this.
      // The artist's own catalogue answers reliably and is already how a
      // submission finds its audio.
      const { songs } = await appleArtistCatalogue(current.artistName);
      const hit = songs.find((r) => titleMatches(current.title, r.trackName));
      if (!hit?.previewUrl) {
        const names = [...new Set(songs.map((r) => r.trackName))].slice(0, 8).join(", ");
        return NextResponse.json(
          {
            error: songs.length
              ? `We couldn't find "${current.title}" among ${current.artistName}'s songs on Apple. Found: ${names}. Open the song itself on Apple Music, use Share, then Copy Link, so the link carries the song id.`
              : `Apple returned no songs for ${current.artistName}. Open the song itself on Apple Music and copy its link.`,
          },
          { status: 400 }
        );
      }
      resolved = hit.previewUrl;
    }

    if (!/^https?:\/\//i.test(resolved)) {
      return NextResponse.json({ error: "That doesn't look like a link." }, { status: 400 });
    }

    try {
      const probe = await fetch(resolved, { headers: { Range: "bytes=0-500" } });
      if (!probe.ok) throw new Error(String(probe.status));
      // Reachable is not the same as playable. An Apple Music web page answers
      // 200 to this, which is exactly how a page URL came to be stored as a
      // preview and play silence.
      const type = probe.headers.get("content-type") ?? "";
      if (!/^audio\//i.test(type)) {
        return NextResponse.json(
          {
            error: `That link isn't audio, it answered with ${
              type || "no content type"
            }. It needs to be a preview file, not an Apple Music page.`,
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "That link didn't play when we tried it. Check it and try again." },
        { status: 400 }
      );
    }

    const updated = await prisma.track.update({
      where: { id: trackId },
      // Audio pasted by hand is vouched for, not matched. Marking it null
      // would send it back through the health check, which would fail to
      // find it on Apple and offer to repair over a deliberate choice.
      data: { previewUrl: resolved, audioVerdict: "VOUCHED", audioCheckedAt: new Date() },
    });
    return NextResponse.json({ track: { id: updated.id, previewUrl: updated.previewUrl } });
  }

  if (!trackId || (action !== "PULL" && action !== "RESTORE")) {
    return NextResponse.json(
      { error: "trackId and action ('PULL' | 'RESTORE' | 'SET_GENRE') are required" },
      { status: 400 }
    );
  }

  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  const updated = await prisma.track.update({
    where: { id: trackId },
    data: {
      status: action === "PULL" ? "REJECTED" : "DISCOVERY",
      reviewNote: typeof note === "string" && note.trim() ? note.trim() : track.reviewNote,
    },
  });

  return NextResponse.json({ track: { id: updated.id, status: updated.status } });
}
