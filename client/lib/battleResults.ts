import { prisma } from "./prisma";
import { battleLostEmail, battleTieEmail, battleWonEmail, sendEmail } from "./email";
import { isEmailAddress } from "./emailAddress";
import { artistUnsubscribeUrl } from "./nudges";

/**
 * Tells each artist how their battle went, as soon as it is decided.
 *
 * A battle is decided when its week closes, or mid-week when the other
 * song is pulled. Either way it becomes settled, and every settled battle
 * with a side not yet told is picked up here. Run after a Battles request
 * has been answered, so it rides on traffic the app already has: no timer,
 * and no extra wake-ups for the database.
 *
 * Each side is claimed before it is sent, so two requests arriving
 * together cannot send the same result twice. A battle that closes with
 * no winner, a tie or one nobody voted in, gets the tie email on both
 * sides. A pulled song, an artist who has opted out and an address that
 * cannot receive mail are claimed and not written to.
 *
 * Bounded per call, because a request has about ten seconds in all. On the
 * Sunday a week closes there are many to send, and the next few visits
 * finish them.
 */
const BUDGET_MS = 4000;
const PACE_MS = 550;
const APP = "https://app.musicontherox.com";

export async function sendBattleResults(): Promise<{ sent: number; skipped: number }> {
  const started = Date.now();
  let sent = 0;
  let skipped = 0;

  const battles = await prisma.battle.findMany({
    where: {
      settledAt: { not: null },
      cancelledAt: null,
      OR: [{ resultSentAAt: null }, { resultSentBAt: null }],
    },
    orderBy: { settledAt: "asc" },
    take: 15,
    select: {
      id: true,
      trackAId: true,
      trackBId: true,
      winnerId: true,
      resultSentAAt: true,
      resultSentBAt: true,
    },
  });

  for (const b of battles) {
    for (const side of ["A", "B"] as const) {
      if (Date.now() - started > BUDGET_MS) return { sent, skipped };
      if (side === "A" ? b.resultSentAAt : b.resultSentBAt) continue;

      const field = side === "A" ? "resultSentAAt" : "resultSentBAt";
      const claimed = await prisma.battle.updateMany({
        where: { id: b.id, [field]: null },
        data: { [field]: new Date() },
      });
      if (claimed.count === 0) continue;

      const trackId = side === "A" ? b.trackAId : b.trackBId;
      const track = await prisma.track.findUnique({
        where: { id: trackId },
        select: {
          title: true,
          status: true,
          artist: { select: { id: true, email: true, emailOptOut: true } },
        },
      });

      const a = track?.artist;
      if (
        !track ||
        track.status === "REJECTED" ||
        !a ||
        a.emailOptOut ||
        !a.email ||
        !isEmailAddress(a.email)
      ) {
        skipped += 1;
        continue;
      }

      const unsubscribeUrl = artistUnsubscribeUrl(a.id, APP);
      const template = !b.winnerId
        ? battleTieEmail({ title: track.title, unsubscribeUrl })
        : b.winnerId === trackId
          ? battleWonEmail({ title: track.title, unsubscribeUrl })
          : battleLostEmail({ title: track.title, unsubscribeUrl });
      const result = await sendEmail(a.email, template);
      if (result.ok) sent += 1;
      else skipped += 1;
      await new Promise((r) => setTimeout(r, PACE_MS));
    }
  }
  return { sent, skipped };
}
