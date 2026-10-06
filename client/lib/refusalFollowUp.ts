import { prisma } from "./prisma";
import { sendEmail, submissionFailedEmail } from "./email";
import { describeSpotifyLink, parseSpotifyTrackId } from "./spotifyUrl";

/**
 * Tells an artist why a submission failed, a few minutes after it did.
 *
 * Delayed rather than immediate, for two reasons. One artist sent six album
 * links in a single sitting, and six emails saying the same thing is worse
 * than silence. And someone who notices their own mistake and fixes it in the
 * next minute should never receive a note about a problem they already solved.
 *
 * Marked per refusal as it sends, so nobody is told twice.
 */

/** How long a refusal has to sit before the artist hears about it. */
const QUIET_MINUTES = 6;

/** Anything older than this is history, not something to chase. */
const MAX_AGE_HOURS = 48;

export async function pendingRefusalFollowUps() {
  const now = Date.now();
  const rows = await prisma.refusedSubmission.findMany({
    where: {
      helpedAt: null,
      status: { not: "ADDED" },
      createdAt: {
        lte: new Date(now - QUIET_MINUTES * 60 * 1000),
        gte: new Date(now - MAX_AGE_HOURS * 60 * 60 * 1000),
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const byEmail = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.artistEmail.trim().toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), r]);
  }

  return [...byEmail.entries()]
    .filter(([email]) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email))
    .map(([email, refusals]) => ({
      email,
      refusals,
      albums: refusals.filter(
        (r) => !parseSpotifyTrackId(r.spotifyUrl) && describeSpotifyLink(r.spotifyUrl) === "album"
      ).length,
    }));
}

export async function sendRefusalFollowUps(appUrl: string) {
  const due = await pendingRefusalFollowUps();
  let sent = 0;
  let failed = 0;

  for (const group of due) {
    const artist = await prisma.artist.findFirst({
      where: { email: { equals: group.email, mode: "insensitive" } },
      select: { name: true, emailOptOut: true },
    });
    // An artist who asked for no email still gets none, even about a failure.
    if (artist?.emailOptOut) {
      await prisma.refusedSubmission
        .updateMany({ where: { id: { in: group.refusals.map((r) => r.id) } }, data: { helpedAt: new Date() } })
        .catch(() => {});
      continue;
    }

    const result = await sendEmail(
      group.email,
      submissionFailedEmail({
        name: artist?.name ?? null,
        items: group.refusals.map((r) => ({ url: r.spotifyUrl, reason: r.reason })),
        albums: group.albums,
        appUrl,
      })
    );

    if (!result.ok) {
      failed += 1;
      continue;
    }
    sent += 1;
    await prisma.refusedSubmission
      .updateMany({ where: { id: { in: group.refusals.map((r) => r.id) } }, data: { helpedAt: new Date() } })
      .catch(() => {});
  }

  return { eligible: due.length, sent, failed };
}
