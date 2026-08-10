import { Prisma, SwipeDirection } from "@prisma/client";
import { prisma } from "./prisma";
import { sendEmail, trackBrokeThroughEmail } from "./email";

export class AlreadySwipedError extends Error {
  constructor() {
    super("This fan has already swiped on this track");
  }
}

/**
 * Hearing the clip out makes a verdict count double.
 *
 * The average decision was arriving after five seconds of thirty, which is a
 * reaction to a first impression rather than to a song. Weighting by
 * attention means the tracks that break through are the ones people actually
 * sat with, and it costs a fast swiper nothing — their vote still counts.
 *
 * Applied to left-swipes too, deliberately. "I heard the whole thing and
 * still passed" is a stronger no than a three-second skip, and weighting only
 * the yeses would inflate every approval rate on the platform.
 *
 * 28s rather than 30s: the clip is clamped at 30,000ms and a listener who
 * swipes as it fades shouldn't be punished for the last fraction of a second.
 */
export const FULL_LISTEN_MS = 28_000;

export function voteWeight(listenMs?: number | null): number {
  return typeof listenMs === "number" && listenMs >= FULL_LISTEN_MS ? 2 : 1;
}

// Fan swipes are the front door: every track starts in DISCOVERY, open to
// fans (not curators). Once a track wins over a high enough *share* of the
// fans who heard it, the artist owes a fee to unlock the paid curator-vetting
// stage (VETTING).
//
// The gate is a rate over a minimum sample (default 55% of 100 votes) rather
// than a raw count of right-swipes. A raw count rewards exposure: a track put
// in front of thousands of people reaches 100 approvals on a 10% hit rate,
// while a genuinely loved track shown to 150 people might not. Both numbers
// live on the Track row so they can be retuned without a deploy.
export async function recordFanSwipe(params: {
  fanId: string;
  trackId: string;
  direction: SwipeDirection;
  /** Milliseconds listened before deciding, if the client reported it. */
  listenMs?: number | null;
}) {
  const { fanId, trackId, direction, listenMs } = params;

  const weight = voteWeight(listenMs);

  const result = await prisma.$transaction(async (tx) => {
    try {
      await tx.fanSwipe.create({
        data: { fanId, trackId, direction, listenMs: listenMs ?? null, weight },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AlreadySwipedError();
      }
      throw e;
    }

    const track = await tx.track.findUniqueOrThrow({ where: { id: trackId } });

    const isRight = direction === "RIGHT";
    const fanRightSwipes = track.fanRightSwipes + (isRight ? 1 : 0);
    const fanLeftSwipes = track.fanLeftSwipes + (isRight ? 0 : 1);

    // Headcount stays headcount; the gate runs on the weighted tally.
    const weightedRightVotes = track.weightedRightVotes + (isRight ? weight : 0);
    const weightedTotalVotes = track.weightedTotalVotes + weight;

    const totalVotes = weightedTotalVotes;
    const approvalRate = totalVotes > 0 ? weightedRightVotes / totalVotes : 0;

    // A track that misses the rate at 100 votes isn't dead — it can still
    // clear later if opinion improves. Only the sample floor is one-way.
    const feeNowRequested =
      track.status === "DISCOVERY" &&
      track.feeStatus === "NOT_REQUIRED" &&
      // No artist behind it means nobody can be invited to pay. The seeded
      // catalogue is like this: it exists to give fans something to swipe,
      // not to be sold onward, and without this check those tracks jam the
      // admin's awaiting-payment queue with rows that can never clear.
      track.artistId !== null &&
      totalVotes >= track.requiredFanVotes &&
      approvalRate >= track.requiredApprovalRate;

    const updatedTrack = await tx.track.update({
      where: { id: trackId },
      data: {
        fanRightSwipes,
        fanLeftSwipes,
        weightedRightVotes,
        weightedTotalVotes,
        ...(feeNowRequested ? { feeStatus: "PENDING" } : {}),
      },
    });

    if (feeNowRequested && updatedTrack.artistId) {
      await tx.artistNotification.create({
        data: { artistId: updatedTrack.artistId, trackId },
      });
    }

    return { track: updatedTrack, feeNowRequested };
  });

  // Emailed outside the transaction: a slow mail call shouldn't hold a DB
  // lock open, and a failed send shouldn't roll back the fan's swipe.
  if (result.feeNowRequested && result.track.artistId) {
    const artist = await prisma.artist.findUnique({
      where: { id: result.track.artistId },
      select: { email: true },
    });

    if (artist?.email) {
      await sendEmail(
        artist.email,
        trackBrokeThroughEmail({
          trackTitle: result.track.title,
          artistName: result.track.artistName,
          approvals: result.track.fanRightSwipes,
          approvalRate:
            result.track.fanRightSwipes /
            Math.max(1, result.track.fanRightSwipes + result.track.fanLeftSwipes),
          trackId: result.track.id,
        })
      );
    }
  }

  return result;
}
