import { prisma } from "./prisma";
import {
  FEATURE_FEE_CENTS,
  HELD_SHARE_TYPES,
  PAYOUT_MATURITY_DAYS,
  SHARE_HOLD_DAYS,
  daysFromNow,
} from "./payouts";

export type ShareType = "PLAYLIST" | "VIDEO" | "ARTICLE";

export class FeatureError extends Error {}

/**
 * A curator claims they've shared a track — on a playlist, in a short-form
 * video, or in writing. Nothing is earned yet: placements that can be pulled
 * have to survive the hold period first, and the proof still gets checked.
 */
export async function submitFeature(params: {
  assignmentId: string;
  userId: string;
  type: ShareType;
  proofUrl: string;
}) {
  const { assignmentId, userId, type, proofUrl } = params;

  const assignment = await prisma.curatorAssignment.findUnique({
    where: { id: assignmentId },
    include: { feature: true },
  });

  if (!assignment) throw new FeatureError("Assignment not found");
  if (assignment.userId !== userId) throw new FeatureError("That isn't your assignment");
  if (assignment.feature) throw new FeatureError("You've already submitted a share for this track");
  if (assignment.status !== "PENDING") {
    throw new FeatureError(`You've already ${assignment.status.toLowerCase()} this track`);
  }

  return prisma.$transaction(async (tx) => {
    const feature = await tx.feature.create({
      data: {
        assignmentId,
        type,
        proofUrl,
        // Playlist adds and video posts can be pulled straight after
        // submitting, so they have to stay up. A published article is
        // treated as durable and clears immediately.
        holdUntil: (HELD_SHARE_TYPES as readonly string[]).includes(type)
          ? daysFromNow(SHARE_HOLD_DAYS)
          : new Date(),
      },
    });

    await tx.curatorAssignment.update({
      where: { id: assignmentId },
      data: { status: "FEATURED", decidedAt: new Date() },
    });

    return feature;
  });
}

export async function passOnAssignment(assignmentId: string, userId: string) {
  const assignment = await prisma.curatorAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new FeatureError("Assignment not found");
  if (assignment.userId !== userId) throw new FeatureError("That isn't your assignment");
  if (assignment.status !== "PENDING") {
    throw new FeatureError(`You've already ${assignment.status.toLowerCase()} this track`);
  }

  return prisma.curatorAssignment.update({
    where: { id: assignmentId },
    data: { status: "PASSED", decidedAt: new Date() },
  });
}

/**
 * Verifying a feature is what actually earns the flat fee. The payout starts
 * HELD and matures separately before it can be cashed out.
 */
export async function verifyFeature(featureId: string) {
  const feature = await prisma.feature.findUnique({
    where: { id: featureId },
    include: { assignment: true, payout: true },
  });

  if (!feature) throw new FeatureError("Feature not found");
  if (feature.status === "VERIFIED") throw new FeatureError("Already verified");
  if (feature.payout) throw new FeatureError("This share has already been paid");
  if (feature.holdUntil > new Date()) {
    throw new FeatureError(
      `This share hasn't cleared its hold yet — it clears ${feature.holdUntil.toISOString().slice(0, 10)}.`
    );
  }

  return prisma.$transaction(async (tx) => {
    const verified = await tx.feature.update({
      where: { id: featureId },
      data: { status: "VERIFIED", verifiedAt: new Date() },
    });

    const payout = await tx.curatorPayout.create({
      data: {
        userId: feature.assignment.userId,
        trackId: feature.assignment.trackId,
        featureId,
        amountCents: FEATURE_FEE_CENTS,
        maturesAt: daysFromNow(PAYOUT_MATURITY_DAYS),
      },
    });

    return { feature: verified, payout };
  });
}

export async function rejectFeature(featureId: string, reason: string) {
  const feature = await prisma.feature.findUnique({
    where: { id: featureId },
    include: { payout: true },
  });
  if (!feature) throw new FeatureError("Feature not found");
  if (feature.payout) {
    throw new FeatureError("This share was already paid — reverse the payout first");
  }

  return prisma.feature.update({
    where: { id: featureId },
    data: { status: "REJECTED", rejectedReason: reason },
  });
}
