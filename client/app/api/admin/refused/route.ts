import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import {
  TrackLookupError,
  fetchSpotifyArtist,
  fetchSpotifyOembed,
  resolveSpotifyTrack,
} from "@/lib/trackLookup";
import { parseSpotifyTrackId } from "@/lib/spotifyUrl";

/**
 * Turns whatever an admin pasted into a playable preview URL.
 *
 * Accepts an Apple Music/iTunes link in any of its shapes, a bare Apple track
 * id, or a direct audio URL — and refuses anything that doesn't actually play
 * when asked, so a typo can't be filed as working audio.
 */
async function resolveManualAudio(raw: string): Promise<{ previewUrl: string } | { error: string }> {
  let resolved = raw;

  const appleId =
    raw.match(/[?&]i=(\d+)/)?.[1] ??
    raw.match(/\/song\/[^/]*\/(\d+)/)?.[1] ??
    (/^\d{6,}$/.test(raw) ? raw : undefined);

  if (appleId) {
    const look = await fetch(`https://itunes.apple.com/lookup?id=${appleId}`).catch(() => null);
    const data = look?.ok ? await look.json() : null;
    const hit = data?.results?.[0];
    if (!hit?.previewUrl) return { error: "That Apple link has no preview available." };
    resolved = hit.previewUrl;
  }

  if (!/^https?:\/\//i.test(resolved)) return { error: "That doesn't look like a link." };

  try {
    const probe = await fetch(resolved, { headers: { Range: "bytes=0-500" } });
    if (!probe.ok) throw new Error(String(probe.status));
  } catch {
    return { error: "That link didn't play when we tried it. Check it and try again." };
  }

  return { previewUrl: resolved };
}

/** Title and artist straight from Spotify, for a track being added by hand. */
async function fetchSpotifyDetails(trackId: string) {
  const [oembed, artist] = await Promise.all([
    fetchSpotifyOembed(trackId).catch(() => null),
    fetchSpotifyArtist(trackId).catch(() => null),
  ]);
  if (!oembed?.title) return null;

  // oEmbed titles arrive as "Artist - Title" or just the title depending on
  // the release, so the artist half is stripped when we know it.
  const title = artist
    ? oembed.title.replace(new RegExp(`^${artist}\\s*[-–]\\s*`, "i"), "").trim()
    : oembed.title.trim();

  return {
    title: title || oembed.title,
    artistName: artist ?? "Unknown artist",
    artworkUrl: oembed.thumbnail_url ?? null,
  };
}

/**
 * Closes out refusals whose track is now on the platform.
 *
 * A refusal is only a job while the track is missing. It gets marked ADDED
 * when it's rescued through this screen, but a track can arrive by other
 * routes — the artist retries and it works, or it's added by hand elsewhere —
 * and nothing was watching for that, so the failure sat in the queue asking
 * to be dealt with long after it was.
 *
 * Run on read rather than by a cron: it's two queries, it only ever touches
 * rows that are provably stale, and there's no schedule to forget.
 */
async function reconcile() {
  const pending = await prisma.refusedSubmission.findMany({
    where: { status: "PENDING" },
    select: { id: true, spotifyUrl: true },
  });
  if (pending.length === 0) return;

  const ids = new Map<string, string>();
  for (const row of pending) {
    const trackId = parseSpotifyTrackId(row.spotifyUrl);
    if (trackId) ids.set(trackId, row.id);
  }
  if (ids.size === 0) return;

  const live = await prisma.track.findMany({
    where: { source: "SPOTIFY", externalId: { in: [...ids.keys()] } },
    select: { externalId: true },
  });

  const resolved = live.map((t) => ids.get(t.externalId)!).filter(Boolean);
  if (resolved.length > 0) {
    await prisma.refusedSubmission.updateMany({
      where: { id: { in: resolved } },
      data: { status: "ADDED" },
    });
  }
}

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await reconcile();

  const view = req.nextUrl.searchParams.get("view") ?? "pending";
  const where =
    view === "all" ? {} : { status: view === "handled" ? { not: "PENDING" as const } : "PENDING" as const };

  const [items, pending] = await Promise.all([
    prisma.refusedSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.refusedSubmission.count({ where: { status: "PENDING" } }),
  ]);

  return NextResponse.json({ items, pendingCount: pending });
}

/**
 * Adds a refused submission to the feed, optionally with a corrected link.
 *
 * The artist's email and genre come from their original attempt, so the
 * track ends up attached to them exactly as if it had gone through
 * normally — which is the point: they submitted once.
 */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action, spotifyUrl, genre, audioUrl } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const refused = await prisma.refusedSubmission.findUnique({ where: { id } });
  if (!refused) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "DISMISS") {
    await prisma.refusedSubmission.update({ where: { id }, data: { status: "DISMISSED" } });
    return NextResponse.json({ ok: true });
  }

  if (action === "REOPEN") {
    await prisma.refusedSubmission.update({ where: { id }, data: { status: "PENDING" } });
    return NextResponse.json({ ok: true });
  }

  if (action !== "ADD") {
    return NextResponse.json(
      { error: "action must be 'ADD', 'DISMISS' or 'REOPEN'" },
      { status: 400 }
    );
  }

  // A corrected link if you pasted one, otherwise their original.
  const url = typeof spotifyUrl === "string" && spotifyUrl.trim() ? spotifyUrl.trim() : refused.spotifyUrl;
  const trackId = parseSpotifyTrackId(url);
  if (!trackId) {
    return NextResponse.json({ error: "That isn't a Spotify track link." }, { status: 400 });
  }

  let resolved;
  // Audio an admin supplied by hand is trusted, not matched — and has to be
  // recorded as such, or the health check hunts for it on Apple, fails for
  // exactly the reason it was supplied by hand, and offers to "repair" over
  // the top of a deliberate choice.
  let vouched = false;
  try {
    resolved = await resolveSpotifyTrack(trackId);
  } catch (e) {
    // Matching got stricter so that nobody's audio is ever wrong again, which
    // necessarily means refusing more. Without an override the strictness
    // becomes a dead end: a track Apple genuinely can't match could be added
    // by nobody, not even by hand, and the artist is simply stuck.
    //
    // So an admin may supply the audio directly — an Apple Music link or a
    // preview URL — and vouch for it. Spotify still supplies the title and
    // artist, so the only thing being taken on trust is the recording.
    const manual = typeof audioUrl === "string" ? audioUrl.trim() : "";
    if (!manual) {
      return NextResponse.json(
        {
          error:
            e instanceof TrackLookupError
              ? `${e.message} You can add it anyway by pasting an Apple Music link or a direct preview URL below.`
              : "Couldn't resolve that link.",
          needsAudio: true,
        },
        { status: 422 }
      );
    }

    const manualAudio = await resolveManualAudio(manual);
    if ("error" in manualAudio) {
      return NextResponse.json({ error: manualAudio.error, needsAudio: true }, { status: 400 });
    }

    const details = await fetchSpotifyDetails(trackId);
    if (!details) {
      return NextResponse.json(
        { error: "Couldn't read the title and artist from that Spotify link." },
        { status: 422 }
      );
    }

    vouched = true;
    resolved = {
      title: details.title,
      artistName: details.artistName,
      albumName: null,
      artworkUrl: details.artworkUrl,
      previewUrl: manualAudio.previewUrl,
      durationMs: null,
    };
  }

  const existing = await prisma.track.findUnique({
    where: { source_externalId: { source: "SPOTIFY", externalId: trackId } },
  });
  if (existing) {
    await prisma.refusedSubmission.update({ where: { id }, data: { status: "ADDED" } });
    return NextResponse.json({ track: existing, alreadyExisted: true });
  }

  // Attach it to the artist who originally submitted, by their email.
  const artist = await prisma.artist.upsert({
    where: { email: refused.artistEmail },
    update: {},
    create: {
      email: refused.artistEmail,
      name: resolved.artistName.split(/[,&]/)[0].trim(),
    },
  });

  const track = await prisma.track.create({
    data: {
      source: "SPOTIFY",
      externalId: trackId,
      title: resolved.title,
      artistName: resolved.artistName,
      albumName: resolved.albumName,
      artworkUrl: resolved.artworkUrl,
      previewUrl: resolved.previewUrl,
      durationMs: resolved.durationMs,
      artistId: artist.id,
      genre: (typeof genre === "string" && genre) || refused.genre || null,
      ...(vouched ? { audioVerdict: "VOUCHED", audioCheckedAt: new Date() } : {}),
    },
  });

  await prisma.refusedSubmission.update({ where: { id }, data: { status: "ADDED" } });

  return NextResponse.json({ track, artist: { name: artist.name, email: artist.email } });
}
