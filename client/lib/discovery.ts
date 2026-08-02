import { Prisma, SwipeDirection } from "@prisma/client";
import { prisma } from "./prisma";
import { sendEmail, trackBrokeThroughEmail } from "./email";

export class AlreadySwipedError extends Error {
  constructor() {
    super("This fan has already swiped on this track");
  }
}

// Fan swipes are the front door: every track starts in DISCOVERY, open to
// fans (not curators). Once a track's fan right-swipes cross its threshold,
// the artist owes a fee to unlock the paid curator-vetting stage (VETTING).
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

    const feeNowRequested =
      track.status === "DISCOVERY" &&
      track.feeStatus === "NOT_REQUIRED" &&
      fanRightSwipes >= track.requiredFanApprovals;

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
          trackId: result.track.id,
        })
      );
    }
  }

  return result;
}
