import { prisma } from "./prisma";
import { artistUnsubscribeUrl } from "./nudges";
import { sendEmail, submitMoreMusicEmail } from "./email";

/**
 * The come-back email for artists: you're in the feed, send us more.
 *
 * Three rules keep it from becoming a nag, and they matter more here than
 * for listeners — an artist who feels chased is one who stops submitting
 * anywhere near you.
 *
 *  - Nobody who has submitted recently. They have nothing new to send, and
 *    asking implies we weren't paying attention.
 *  - A long gap between sends, so this can be scheduled weekly without any
 *    one artist hearing from us weekly.
 *  - It stops after three unanswered. Someone who ignored three isn't coming
 *    back because of a fourth.
 *
 * It leads with how their existing tracks are doing rather than with the ask.
 * "Your music picked up 40 saves, got more?" is a different email from "got
 * more?", and only one of them is worth opening.
 */

/** Long enough that a scheduled weekly run doesn't mail the same artist weekly. */
const GAP_DAYS = 21;

/** Someone who submitted this recently has nothing new to be asked for. */
const QUIET_DAYS = 30;

const MAX_NUDGES = 3;

export type ArtistNudgeCandidate = {
  artistId: string;
  name: string;
  email: string;
  tracks: number;
  saves: number;
  lastSubmittedAt: string | null;
  nudgeCount: number;
};

export type ArtistNudgeResult = { eligible: number; sent: number; failed: number };

async function candidates(): Promise<ArtistNudgeCandidate[]> {
  const now = Date.now();
  const gapCutoff = new Date(now - GAP_DAYS * 24 * 60 * 60 * 1000);
  const quietCutoff = new Date(now - QUIET_DAYS * 24 * 60 * 60 * 1000);

  const artists = await prisma.artist.findMany({
    where: {
      emailOptOut: false,
      nudgeCount: { lt: MAX_NUDGES },
      OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lt: gapCutoff } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      nudgeCount: true,
      tracks: {
        where: { status: { not: "REJECTED" } },
        select: { fanRightSwipes: true, createdAt: true },
      },
    },
  });

  const due: ArtistNudgeCandidate[] = [];

  for (const artist of artists) {
    if (!artist.email || artist.tracks.length === 0) continue;

    const lastSubmitted = artist.tracks.reduce<Date | null>(
      (latest, t) => (!latest || t.createdAt > latest ? t.createdAt : latest),
      null
    );
    // Still in their submission window — leave them alone.
    if (lastSubmitted && lastSubmitted > quietCutoff) continue;

    due.push({
      artistId: artist.id,
      name: artist.name,
      email: artist.email,
      tracks: artist.tracks.length,
      saves: artist.tracks.reduce((n, t) => n + t.fanRightSwipes, 0),
      lastSubmittedAt: lastSubmitted ? lastSubmitted.toISOString() : null,
      nudgeCount: artist.nudgeCount,
    });
  }

  // Best performers first, so a partial run reaches the artists most likely
  // to have something worth hearing next.
  due.sort((a, b) => b.saves - a.saves);
  return due;
}

/** Who is due and why. Sends nothing. */
export async function previewArtistNudges() {
  const due = await candidates();
  return { eligible: due.length, artists: due };
}

export async function sendArtistNudges(appUrl: string): Promise<ArtistNudgeResult> {
  const due = await candidates();
  let sent = 0;
  let failed = 0;

  for (const artist of due) {
    const result = await sendEmail(
      artist.email,
      submitMoreMusicEmail({
        name: artist.name,
        tracks: artist.tracks,
        saves: artist.saves,
        appUrl,
        unsubscribeUrl: artistUnsubscribeUrl(artist.artistId, appUrl),
      })
    );

    if (!result.ok) {
      failed += 1;
      continue;
    }

    sent += 1;
    // Counted only on a successful send, so a mail outage doesn't silently
    // burn someone's three.
    await prisma.artist.update({
      where: { id: artist.artistId },
      data: { lastNudgeAt: new Date(), nudgeCount: { increment: 1 } },
    });
  }

  return { eligible: due.length, sent, failed };
}

/** Called when an artist submits: they came back, so the count starts over. */
export async function resetArtistNudges(artistId: string) {
  await prisma.artist
    .updateMany({ where: { id: artistId, nudgeCount: { gt: 0 } }, data: { nudgeCount: 0 } })
    .catch(() => {});
}
