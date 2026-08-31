import { prisma } from "./prisma";
import { artistUnsubscribeUrl } from "./nudges";
import { sendEmail, trackMilestoneEmail } from "./email";

/**
 * Progress email for artists, sent when a track crosses a round number.
 *
 * Deliberately not a weekly digest. A weekly send has to say something every
 * week, and on a platform still building an audience that means a lot of
 * "0 new swipes this week" — which reads as failure, teaches artists to
 * ignore the sender, and makes MOTR look emptier than it is. A milestone
 * email can only ever arrive with good news in it, because the milestone
 * having been crossed *is* the news.
 *
 * For the same reason every figure quoted is a running total, never a change
 * since last time. "27 right swipes" is a fact an artist can be pleased with.
 * "3 more than last week" invites the question of what happened the week the
 * number was 0.
 */

/**
 * The rungs. The first is 1 rather than 5 because the moment a stranger first
 * saves your song is the one worth telling you about, and the ladder keeps
 * going because the hundredth save is the most persuasive moment there will
 * ever be to ask someone to share the app.
 */
export const MILESTONES = [1, 10, 25, 50, 100, 250, 500] as const;

/** Ledger rows are typed like this so a rung is only ever sent once. */
const typeFor = (n: number) => `RIGHT_SWIPES_${n}`;

/** The highest rung this count has reached, or null below the first. */
function reached(rightSwipes: number): number | null {
  let hit: number | null = null;
  for (const m of MILESTONES) if (rightSwipes >= m) hit = m;
  return hit;
}

export type MilestoneTrack = {
  trackId: string;
  title: string;
  rightSwipes: number;
  milestone: number;
};

export type MilestoneRecipient = {
  artistId: string;
  artistName: string;
  email: string;
  tracks: MilestoneTrack[];
};

/**
 * Who is due an email, and what it would say.
 *
 * Read-only: nothing is sent and nothing is recorded. The dashboard shows
 * this first so a real send is never a surprise.
 */
export async function pendingMilestones(): Promise<MilestoneRecipient[]> {
  const artists = await prisma.artist.findMany({
    // Someone who opted out stays opted out. Checked here rather than at the
    // send so they never appear in the preview either — a list you can see
    // but must not mail is an accident waiting to happen.
    where: { emailOptOut: false },
    select: {
      id: true,
      name: true,
      email: true,
      tracks: {
        // Tracks with no artist behind them are the seeded catalogue; they
        // are excluded structurally by being read through the artist.
        where: { fanRightSwipes: { gt: 0 }, status: { not: "REJECTED" } },
        select: { id: true, title: true, fanRightSwipes: true },
      },
      notifications: { select: { trackId: true, type: true } },
    },
  });

  const due: MilestoneRecipient[] = [];

  for (const artist of artists) {
    if (!artist.email) continue;

    const already = new Set(artist.notifications.map((n) => `${n.trackId}:${n.type}`));
    const tracks: MilestoneTrack[] = [];

    for (const track of artist.tracks) {
      const milestone = reached(track.fanRightSwipes);
      if (milestone === null) continue;
      // Only the highest rung reached. An artist joining with a track already
      // past 50 gets one email about 50, not five about every rung below it.
      if (already.has(`${track.id}:${typeFor(milestone)}`)) continue;

      tracks.push({
        trackId: track.id,
        title: track.title,
        rightSwipes: track.fanRightSwipes,
        milestone,
      });
    }

    if (tracks.length === 0) continue;

    // Best performer first: it is the reason they will open the next one.
    tracks.sort((a, b) => b.rightSwipes - a.rightSwipes);
    due.push({ artistId: artist.id, artistName: artist.name, email: artist.email, tracks });
  }

  return due;
}

export type MilestoneSendResult = {
  eligible: number;
  sent: number;
  failed: number;
  tracksMarked: number;
};

/**
 * Sends the pending emails and records what went out.
 *
 * One email per artist however many of their tracks moved — the requirement
 * that made this worth writing rather than looping over tracks.
 *
 * The ledger row is written only after a successful send, so a mail failure
 * leaves the milestone pending rather than silently consuming it. The cost of
 * that choice is a possible duplicate if the write fails after the send; the
 * alternative loses the news entirely, which is worse.
 */
export async function sendMilestoneEmails(appUrl: string): Promise<MilestoneSendResult> {
  const due = await pendingMilestones();
  let sent = 0;
  let failed = 0;
  let tracksMarked = 0;

  for (const recipient of due) {
    const result = await sendEmail(
      recipient.email,
      trackMilestoneEmail({
        artistName: recipient.artistName,
        tracks: recipient.tracks,
        appUrl,
        unsubscribeUrl: artistUnsubscribeUrl(recipient.artistId, appUrl),
      })
    );

    if (!result.ok) {
      failed += 1;
      continue;
    }

    sent += 1;
    for (const track of recipient.tracks) {
      await prisma.artistNotification.create({
        data: {
          artistId: recipient.artistId,
          trackId: track.trackId,
          type: typeFor(track.milestone),
        },
      });
      tracksMarked += 1;
    }
  }

  return { eligible: due.length, sent, failed, tracksMarked };
}
