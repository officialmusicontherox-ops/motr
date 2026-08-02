import { Prisma, SwipeDirection } from "@prisma/client";
import { prisma } from "./prisma";

export class AlreadySwipedError extends Error {
  constructor() {
    super("This user has already swiped on this track");
  }
}

export async function recordSwipe(params: {
  userId: string;
  trackId: string;
  direction: SwipeDirection;
  listenDurationMs?: number;
}) {
  const { userId, trackId, direction, listenDurationMs } = params;

  return prisma.$transaction(async (tx) => {
    try {
      await tx.swipe.create({
        data: { userId, trackId, direction, listenDurationMs },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AlreadySwipedError();
      }
      throw e;
    }

    await tx.user.update({
      where: { id: userId },
      data: { totalSwipes: { increment: 1 } },
    });

    const track = await tx.track.findUniqueOrThrow({ where: { id: trackId } });

    const isRight = direction === "RIGHT";
    const totalListens = track.totalListens + 1;
    const rightSwipes = track.rightSwipes + (isRight ? 1 : 0);
    const leftSwipes = track.leftSwipes + (isRight ? 0 : 1);
    const consecutiveRightSwipes = isRight ? track.consecutiveRightSwipes + 1 : 0;
    const approvalRatio = rightSwipes / totalListens;

    const justGraduated =
      track.status === "VETTING" && consecutiveRightSwipes >= track.requiredListenThreshold;

    const updatedTrack = await tx.track.update({
      where: { id: trackId },
      data: {
        totalListens,
        rightSwipes,
        leftSwipes,
        consecutiveRightSwipes,
        approvalRatio,
        ...(justGraduated ? { status: "GRADUATED", graduatedAt: new Date() } : {}),
      },
    });

    if (justGraduated) {
      // Reward every curator who swiped right on a track that made it out
      // of the vetting pool — this is the reputation signal described in
      // the product spec ("consistently swipe right on tracks that later
      // go on to perform exceptionally well").
      const rightSwipers = await tx.swipe.findMany({
        where: { trackId, direction: "RIGHT" },
        select: { userId: true },
      });

      for (const { userId: swiperId } of rightSwipers) {
        await tx.user.update({
          where: { id: swiperId },
          data: {
            rightSwipesOnGraduated: { increment: 1 },
            curationWeight: { increment: 0.1 },
          },
        });
      }

      // Note: curators are NOT paid here. Earning is decoupled from whether a
      // track performs — a curator earns a flat fee per verified share
      // (see lib/features.ts), so graduating only affects reputation.
    }

    return { track: updatedTrack, justGraduated };
  });
}
