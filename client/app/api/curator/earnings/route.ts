import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WithdrawalError, getCuratorBalance, requestWithdrawal } from "@/lib/payouts";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }

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
  const { userId, payoutDestination } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
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
