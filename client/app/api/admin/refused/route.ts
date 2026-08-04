import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { TrackLookupError, resolveSpotifyTrack } from "@/lib/trackLookup";
import { parseSpotifyTrackId } from "@/lib/spotifyUrl";

/**
 * Submissions the lookup refused, and the means to rescue them.
 *
 * Refusing is right — we won't put audio under an artist's name unless we
 * can confirm it's theirs — but the artist is frequently correct and the
 * track just isn't findable automatically. Their email and genre are kept
 * here so it can be added on their behalf, and they never have to submit
 * the same thing twice.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { id, action, spotifyUrl, genre } = await req.json().catch(() => ({}));
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
  try {
    resolved = await resolveSpotifyTrack(trackId);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof TrackLookupError
            ? e.message
            : "Couldn't resolve that link.",
      },
      { status: 422 }
    );
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
    },
  });

  await prisma.refusedSubmission.update({ where: { id }, data: { status: "ADDED" } });

  return NextResponse.json({ track, artist: { name: artist.name, email: artist.email } });
}
