import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WithdrawalError, getCuratorBalance, requestWithdrawal } from "@/lib/payouts";
import { requireCurator } from "@/lib/curatorAuth";

export async function GET(req: NextRequest) {
  // Balances and payout destinations are nobody else's business.
  const auth = await requireCurator(req.nextUrl.searchParams.get("userId"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

  const [balance, payouts, withdrawals] = await Promise.all([
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
  ]);

  return NextResponse.json({ balance, payouts, withdrawals });
}

export async function POST(req: NextRequest) {
  const { userId: claimed, payoutDestination } = await req.json();

  // Money moves through here. The payout destination is taken from the same
  // body as the id, so without proving the session an attacker holding a
  // curator's id could send that curator's balance to their own PayPal.
  const auth = await requireCurator(claimed);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.userId;

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
