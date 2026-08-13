import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WithdrawalError, getCuratorBalance, requestWithdrawal } from "@/lib/payouts";
import { requireCurator } from "@/lib/curatorAuth";

export async function GET(req: NextRequest) {
  // Balances and payout destinations are nobody else's business.
  const auth = await requireCurator(req.nextUrl.searchParams.get("userId"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  const [balance, payouts, withdrawals, me] = await Promise.all([
    getCuratorBalance(userId),
    prisma.curatorPayout.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { track: { select: { title: true, artistName: true } } },
    }),
    prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
    // So they can see what's on file rather than guessing.
    prisma.user.findUnique({ where: { id: userId }, select: { payoutDestination: true } }),
  ]);

  return NextResponse.json({
    balance,
    payouts,
    withdrawals,
    payoutDestination: me?.payoutDestination ?? null,
  });
}

export async function POST(req: NextRequest) {
  const { userId: claimed, payoutDestination, action } = await req.json();

  // Money moves through here. The payout destination is taken from the same
  // body as the id, so without proving the session an attacker holding a
  // curator's id could send that curator's balance to their own PayPal.
  const auth = await requireCurator(claimed);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  /**
   * Save where to be paid, without cashing out.
   *
   * The address could previously only be set while requesting a withdrawal,
   * which needs a $50 balance — so a curator couldn't record their PayPal
   * until after they'd earned, and had nowhere to check what was on file. It
   * also isn't the same address as their sign-in: Blue Radio signs in with a
   * Gmail account and is paid at their outlet's own domain.
   */
  if (action === "SET_PAYOUT") {
    const next = typeof payoutDestination === "string" ? payoutDestination.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      return NextResponse.json(
        { error: "Enter the email address on your PayPal account." },
        { status: 400 }
      );
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { payoutDestination: next },
      select: { payoutDestination: true },
    });
    return NextResponse.json({ payoutDestination: user.payoutDestination });
  }

  try {
    const withdrawal = await requestWithdrawal(userId, payoutDestination);
    return NextResponse.json({ withdrawal }, { status: 201 });
  } catch (e) {
    if (e instanceof WithdrawalError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}
