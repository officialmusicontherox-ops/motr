import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  newSubmissionEmail,
  refusedSubmissionEmail,
  sendEmail,
  submissionReceivedEmail,
} from "@/lib/email";
import { TrackLookupError, resolveSpotifyTrack, trackIdentity } from "@/lib/trackLookup";
import { parseSpotifyTrackId } from "@/lib/spotifyUrl";

// Two ways to ingest a track into the vetting queue:
//  - { source: "SPOTIFY", spotifyTrackId, submittedById? } -> we look up
//    the catalog metadata + preview_url via the Spotify Web API ourselves.
//  - { source, externalId, title, artistName, previewUrl, ... } -> caller
//    already resolved the catalog data (e.g. from Apple Music's MusicKit
//    JS on the client, which we don't have server credentials for yet).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { source, submittedById, artistEmail, requiredFanVotes, genre } = body;

  if (source !== "SPOTIFY" && source !== "APPLE_MUSIC") {
    return NextResponse.json(
      { error: "source must be SPOTIFY or APPLE_MUSIC" },
      { status: 400 }
    );
  }

  // Artists paste a share link; accept the raw id or a spotify: URI too.
  const spotifyTrackId =
    body.spotifyTrackId ?? (body.spotifyUrl ? parseSpotifyTrackId(body.spotifyUrl) : null);

  if (source === "SPOTIFY" && body.spotifyUrl && !spotifyTrackId) {
    return NextResponse.json(
      { error: "That doesn't look like a Spotify track link." },
      { status: 400 }
    );
  }

  let normalized;
  if (source === "SPOTIFY" && spotifyTrackId && !body.previewUrl) {
    try {
      // Spotify's own catalog API can't supply a preview to new apps, so the
      // playable clip and artwork are assembled from public sources instead.
      const resolved = await resolveSpotifyTrack(spotifyTrackId);
      normalized = {
        source: "SPOTIFY" as const,
        externalId: spotifyTrackId,
        isrc: null,
        ...resolved,
      };
    } catch (e) {
      if (e instanceof TrackLookupError) {
        // Keep the attempt. Refusing is right, but the artist is often
        // correct and the track just needs adding by hand — which nothing
        // recorded, so it survived only as an email that could be missed.
        const url = String(body.spotifyUrl ?? "");
        if (url && artistEmail) {
          await prisma.refusedSubmission
            .upsert({
              where: {
                spotifyUrl_artistEmail: { spotifyUrl: url, artistEmail: String(artistEmail) },
              },
              // A retry bumps the count rather than adding another row.
              update: { attempts: { increment: 1 }, reason: e.message, status: "PENDING" },
              create: {
                spotifyUrl: url,
                artistEmail: String(artistEmail),
                genre: genre ?? null,
                reason: e.message,
              },
            })
            .catch(() => {});
        }

        if (process.env.EMAIL_REPLY_TO && artistEmail) {
          await sendEmail(
            process.env.EMAIL_REPLY_TO,
            refusedSubmissionEmail({
              spotifyUrl: String(body.spotifyUrl ?? ""),
              artistEmail: String(artistEmail),
              reason: e.message,
            })
          );
        }
        return NextResponse.json({ error: e.message }, { status: 422 });
      }
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Track lookup failed" },
        { status: 502 }
      );
    }
  } else {
    const { externalId, title, artistName, previewUrl } = body;
    if (!externalId || !title || !artistName || !previewUrl) {
      return NextResponse.json(
        { error: "externalId, title, artistName, and previewUrl are required" },
        { status: 400 }
      );
    }
    normalized = {
      source,
      externalId,
      isrc: body.isrc ?? null,
      title,
      artistName,
      albumName: body.albumName ?? null,
      artworkUrl: body.artworkUrl ?? null,
      previewUrl,
      durationMs: body.durationMs ?? null,
    };
  }

  if (!normalized.previewUrl) {
    return NextResponse.json(
      { error: "This track has no 30-second preview available from the source catalog" },
      { status: 422 }
    );
  }

  const existing = await prisma.track.findUnique({
    where: { source_externalId: { source: normalized.source, externalId: normalized.externalId } },
  });
  if (existing) {
    return NextResponse.json({ track: existing, alreadyExisted: true });
  }

  // An artist record is what a fee request/payment later attaches to, so
  // resolve (or create) one whenever we're given an email for the track.
  let artistId: string | null = null;
  if (artistEmail) {
    const artist = await prisma.artist.upsert({
      where: { email: artistEmail },
      update: {},
      create: { email: artistEmail, name: normalized.artistName },
    });
    artistId = artist.id;
  }

  // The unique constraint only catches the same Spotify link twice. A single
  // and its album release are different ids but the same recording, and a
  // song competing with itself for swipes is unfair to its own artist as
  // much as to everyone else.
  const identity = trackIdentity(normalized.artistName, normalized.title);
  const sameSong = (
    await prisma.track.findMany({
      where: { status: { in: ["DISCOVERY", "VETTING", "GRADUATED"] } },
      select: { id: true, title: true, artistName: true },
    })
  ).find((t) => trackIdentity(t.artistName, t.title) === identity);

  if (sameSong) {
    return NextResponse.json(
      {
        error: `"${sameSong.title}" by ${sameSong.artistName} is already in the feed. Every track gets one entry, so it isn't competing against itself for swipes.`,
        alreadyExisted: true,
      },
      { status: 409 }
    );
  }

  const track = await prisma.track.create({
    data: {
      ...normalized,
      submittedById: submittedById ?? null,
      artistId,
      genre: genre ?? null,
      ...(typeof requiredFanVotes === "number" ? { requiredFanVotes } : {}),
    },
  });

  // The track is live, so any earlier refusal of it is history, not a job.
  // Without this a successful retry left the failure sitting in the admin
  // queue asking to be dealt with — a track can't be both live and refused.
  if (normalized.source === "SPOTIFY") {
    await prisma.refusedSubmission
      .updateMany({
        where: { status: "PENDING", spotifyUrl: { contains: normalized.externalId } },
        data: { status: "ADDED" },
      })
      .catch(() => {});
  }

  // The artist hears back, and is asked to share while they're most
  // motivated to. Never awaited into failure: a mail problem must not turn a
  // good submission into an error for them.
  if (artistEmail) {
    await sendEmail(
      String(artistEmail),
      submissionReceivedEmail({
        trackTitle: track.title,
        artistName: track.artistName,
        requiredVotes: track.requiredFanVotes,
        requiredRate: track.requiredApprovalRate,
      })
    );
  }

  if (artistEmail && process.env.EMAIL_REPLY_TO) {
    await sendEmail(
      process.env.EMAIL_REPLY_TO,
      newSubmissionEmail({
        trackTitle: track.title,
        artistName: track.artistName,
        genre: track.genre,
        submitterEmail: String(artistEmail),
      })
    );
  }

  return NextResponse.json({ track, alreadyExisted: false }, { status: 201 });
}
