import crypto from "crypto";
import { prisma } from "./prisma";
import { comeBackEmail, sendEmail } from "./email";

/** Away this long and they've probably forgotten the app exists. */
export const INACTIVE_DAYS = 7;

/**
 * Days a listener must go between nudges.
 *
 * Sending is manual, so this is what stops a second click an hour later
 * mailing everyone again. Press the button as often as you like: anyone
 * nudged in the last six days is simply skipped.
 */
const MIN_GAP_DAYS = 6;

/**
 * How many unanswered nudges before we stop.
 *
 * Someone who ignored three isn't going to answer the fourth, and a weekly
 * email to a person who has stopped caring earns spam complaints — which cost
 * the sending domain far more than that listener was ever worth. The count
 * resets the moment they swipe again, so anyone who does come back starts
 * fresh.
 */
const MAX_NUDGES = 3;

/** Sent per run, so one bad batch can't mail the whole list. */
const MAX_PER_RUN = 200;

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

/** Signed so an unsubscribe link can't be forged for someone else's address. */
export function unsubscribeToken(fanId: string) {
  return crypto.createHmac("sha256", secret()).update(`unsub:${fanId}`).digest("hex").slice(0, 32);
}

export function unsubscribeUrl(fanId: string, appUrl: string) {
  return `${appUrl}/unsubscribe?fan=${fanId}&t=${unsubscribeToken(fanId)}`;
}

export type NudgeResult = {
  eligible: number;
  sent: number;
  failed: number;
  skipped: string[];
};

/**
 * Emails listeners who swiped, then stopped coming back.
 *
 * Only people who actually swiped: someone who signed in and left without
 * hearing anything never engaged, and mailing them is closer to cold outreach
 * than a reminder. Anonymous listeners have no address by their own choice and
 * are never included.
 */
export async function sendComeBackEmails(appUrl: string): Promise<NudgeResult> {
  const now = Date.now();
  const inactiveSince = new Date(now - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  const gapCutoff = new Date(now - MIN_GAP_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.fan.findMany({
    where: {
      NOT: { email: null },
      emailOptOut: false,
      nudgeCount: { lt: MAX_NUDGES },
      // Swiped at least once — someone who signed in and left without
      // hearing anything never engaged, and mailing them is cold outreach.
      swipes: { some: {} },
      OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lt: gapCutoff } }],
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      swipes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    take: MAX_PER_RUN * 3,
  });

  // Inactivity is checked here rather than in the query: "no swipe since X"
  // is a NOT-EXISTS over a growing table, and the candidate list is small.
  const due = candidates
    .filter((f) => f.swipes[0] && f.swipes[0].createdAt < inactiveSince)
    .slice(0, MAX_PER_RUN);

  const result: NudgeResult = { eligible: due.length, sent: 0, failed: 0, skipped: [] };

  for (const fan of due) {
    const lastSwipe = fan.swipes[0].createdAt;

    const [saved, newTracks] = await Promise.all([
      prisma.fanSwipe.findMany({
        where: { fanId: fan.id, direction: "RIGHT" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          track: { select: { title: true, artistName: true, weightedTotalVotes: true } },
        },
      }),
      prisma.track.count({
        where: { status: "DISCOVERY", createdAt: { gt: lastSwipe } },
      }),
    ]);

    const mail = await sendEmail(
      fan.email!,
      comeBackEmail({
        username: fan.displayName || fan.username,
        saved: saved.map((s) => ({
          title: s.track.title,
          artistName: s.track.artistName,
          votes: s.track.weightedTotalVotes,
        })),
        newTracks,
        unsubscribeUrl: unsubscribeUrl(fan.id, appUrl),
      })
    );

    if (mail.ok) {
      result.sent += 1;
      await prisma.fan.update({
        where: { id: fan.id },
        data: { lastNudgeAt: new Date(), nudgeCount: { increment: 1 } },
      });
    } else {
      result.failed += 1;
      result.skipped.push(`${fan.email}: ${mail.error ?? "send failed"}`);
    }
  }

  return result;
}
