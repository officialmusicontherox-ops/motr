import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newSubmissionEmail, sendEmail, submissionReceivedEmail } from "@/lib/email";
import { allowRequest, tooManyRequests } from "@/lib/rateLimit";

/** Nobody submits six songs in one sitting; the form stops at five. */
const MAX_BATCH = 5;

/** Long enough for five lookups, short enough that old ids can't be replayed. */
const RECENT_MINUTES = 30;

/**
 * One email for a batch of submissions, sent once the artist has finished
 * adding songs.
 *
 * The ingest route defers its own emails when a batch is in progress, so this
 * is what actually tells the artist their tracks are live — with every share
 * link in one place — and tells the operator what arrived.
 *
 * It's a public route, so it only ever mails an address that already owns the
 * tracks it was given: each id must exist, belong to an artist with exactly
 * that email, and have been created in the last half hour. That makes it
 * useless for mailing anyone who didn't just submit.
 */
export async function POST(req: NextRequest) {
  const gate = await allowRequest("summary", req);
  if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds, "Too many requests.");

  const { artistEmail, trackIds } = await req.json().catch(() => ({}));

  const email = typeof artistEmail === "string" ? artistEmail.trim().toLowerCase() : "";
  const ids = Array.isArray(trackIds)
    ? trackIds.filter((id: unknown) => typeof id === "string").slice(0, MAX_BATCH)
    : [];

  if (!email || ids.length === 0) {
    return NextResponse.json({ error: "artistEmail and trackIds are required" }, { status: 400 });
  }

  const since = new Date(Date.now() - RECENT_MINUTES * 60 * 1000);
  const tracks = await prisma.track.findMany({
    where: {
      id: { in: ids },
      createdAt: { gte: since },
      artist: { email: { equals: email, mode: "insensitive" } },
    },
    select: {
      id: true,
      title: true,
      artistName: true,
      genre: true,
      requiredFanVotes: true,
      requiredApprovalRate: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (tracks.length === 0) {
    // Nothing to confirm, and nothing worth telling a caller who guessed.
    return NextResponse.json({ emailed: false, tracks: 0 });
  }

  const artistMail = await sendEmail(
    email,
    submissionReceivedEmail({
      tracks: tracks.map((t) => ({ id: t.id, title: t.title, artistName: t.artistName })),
      requiredVotes: tracks[0].requiredFanVotes,
      requiredRate: tracks[0].requiredApprovalRate,
    })
  );

  if (process.env.EMAIL_REPLY_TO) {
    await sendEmail(
      process.env.EMAIL_REPLY_TO,
      newSubmissionEmail({
        tracks: tracks.map((t) => ({
          title: t.title,
          artistName: t.artistName,
          genre: t.genre,
        })),
        submitterEmail: email,
      })
    );
  }

  return NextResponse.json({ emailed: artistMail.ok, tracks: tracks.length });
}
