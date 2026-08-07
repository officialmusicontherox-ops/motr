import { prisma } from "./prisma";
import { MIN_WITHDRAWAL_CENTS, WITHDRAWAL_FEE_CENTS } from "./economics";

// The figures themselves live in economics.ts, which has no database import,
// so email templates and copy can quote them without pulling in a Postgres
// driver. Re-exported here so everything that moves money keeps one import.
export * from "./economics";

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
