import { Prisma, SwipeDirection } from "@prisma/client";
import { prisma } from "./prisma";
import { sendEmail, trackBrokeThroughEmail } from "./email";

export class AlreadySwipedError extends Error {
  constructor() {
    super("This fan has already swiped on this track");
  }
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
}) {
  const { fanId, trackId, direction } = params;

  const result = await prisma.$transaction(async (tx) => {
    try {
      await tx.fanSwipe.create({ data: { fanId, trackId, direction } });
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

    const totalVotes = fanRightSwipes + fanLeftSwipes;
    const approvalRate = totalVotes > 0 ? fanRightSwipes / totalVotes : 0;

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
