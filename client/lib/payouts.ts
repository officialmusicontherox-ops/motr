import { prisma } from "./prisma";

// --- Economics, all in one place so they're easy to retune ---

/** Flat fee a curator earns per verified share (playlist placement or article). */
export const FEATURE_FEE_CENTS = 200; // $2.00

/**
 * How long a placement must stay up before it counts. Applies to playlist
 * adds and video posts — both can be pulled the moment they're submitted.
 * A published article is treated as durable and clears immediately.
 */
export const SHARE_HOLD_DAYS = 4;

/** Share types that have to survive the hold period. */
export const HELD_SHARE_TYPES = ["PLAYLIST", "VIDEO"] as const;

/**
 * Holding period before earned money can be cashed out. Covers the
 * chargeback/refund window and Stripe's fund-availability delay, so we never
 * pay out money that can still be clawed back.
 */
export const PAYOUT_MATURITY_DAYS = 7;

/** Minimum balance before a curator can request a cashout — transfer fees make anything smaller uneconomic. */
export const MIN_WITHDRAWAL_CENTS = 5000; // $50.00

/**
 * Flat fee deducted from each cashout to cover the transfer cost, matching
 * how Groover handles it. Disclosed on the earnings screen before a curator
 * requests anything.
 */
export const WITHDRAWAL_FEE_CENTS = 200; // $2.00

/** How many curators a track is routed to once it clears the fan vote. */
export const CURATORS_PER_TRACK = 5;

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export class WithdrawalError extends Error {}

/**
 * Moves matured payouts from HELD to AVAILABLE. Called opportunistically
 * whenever a balance is read, so there's no cron dependency.
 */
export async function settleMaturedPayouts(userId?: string) {
  await prisma.curatorPayout.updateMany({
    where: {
      status: "HELD",
      maturesAt: { lte: new Date() },
      ...(userId ? { userId } : {}),
    },
    data: { status: "AVAILABLE" },
  });
}

export async function getCuratorBalance(userId: string) {
  await settleMaturedPayouts(userId);

  const [held, available, withdrawn] = await Promise.all([
    prisma.curatorPayout.aggregate({
      where: { userId, status: "HELD" },
      _sum: { amountCents: true },
    }),
    prisma.curatorPayout.aggregate({
      where: { userId, status: "AVAILABLE" },
      _sum: { amountCents: true },
    }),
    prisma.curatorPayout.aggregate({
      where: { userId, status: "WITHDRAWN" },
      _sum: { amountCents: true },
    }),
  ]);

  const availableCents = available._sum.amountCents ?? 0;

  return {
    heldCents: held._sum.amountCents ?? 0,
    availableCents,
    withdrawnCents: withdrawn._sum.amountCents ?? 0,
    minWithdrawalCents: MIN_WITHDRAWAL_CENTS,
    withdrawalFeeCents: WITHDRAWAL_FEE_CENTS,
    // What actually lands in their PayPal if they cash out right now.
    netIfWithdrawnCents: Math.max(0, availableCents - WITHDRAWAL_FEE_CENTS),
    canWithdraw: availableCents >= MIN_WITHDRAWAL_CENTS,
  };
}

/**
 * Bundles every AVAILABLE payout into one withdrawal request. Runs in a
 * transaction so a payout can't be attached to two withdrawals at once.
 */
export async function requestWithdrawal(userId: string, payoutDestination?: string) {
  await settleMaturedPayouts(userId);

  return prisma.$transaction(async (tx) => {
    const payouts = await tx.curatorPayout.findMany({
      where: { userId, status: "AVAILABLE", withdrawalId: null },
      select: { id: true, amountCents: true },
    });

    const amountCents = payouts.reduce((sum, p) => sum + p.amountCents, 0);
    if (amountCents < MIN_WITHDRAWAL_CENTS) {
      throw new WithdrawalError(
        `You need at least $${(MIN_WITHDRAWAL_CENTS / 100).toFixed(2)} available to cash out — you have $${(amountCents / 100).toFixed(2)}.`
      );
    }

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const destination = payoutDestination ?? user.payoutDestination;
    if (!destination) {
      throw new WithdrawalError("Add a payout destination (e.g. your PayPal email) first.");
    }

    // The fee comes off the top of what's sent, so amountCents stays equal to
    // the payouts it bundles and the books reconcile; netCents is the transfer.
    const withdrawal = await tx.withdrawal.create({
      data: {
        userId,
        amountCents,
        feeCents: WITHDRAWAL_FEE_CENTS,
        netCents: amountCents - WITHDRAWAL_FEE_CENTS,
        payoutDestination: destination,
      },
    });

    await tx.curatorPayout.updateMany({
      where: { id: { in: payouts.map((p) => p.id) } },
      data: { status: "WITHDRAWN", withdrawalId: withdrawal.id },
    });

    if (payoutDestination && payoutDestination !== user.payoutDestination) {
      await tx.user.update({ where: { id: userId }, data: { payoutDestination } });
    }

    return withdrawal;
  });
}
