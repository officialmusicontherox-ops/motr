import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "REQUESTED";
  const valid = ["REQUESTED", "PAID", "REJECTED"] as const;
  type S = (typeof valid)[number];

  const withdrawals = await prisma.withdrawal.findMany({
    where: valid.includes(status as S) ? { status: status as S } : {},
    orderBy: { requestedAt: "desc" },
    take: 100,
    include: {
      user: { select: { username: true, email: true } },
      _count: { select: { payouts: true } },
    },
  });

  return NextResponse.json({ withdrawals });
}

// Marks a cashout as paid. The actual transfer happens outside the app —
// this records that you've sent it.
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { withdrawalId, decision, note } = await req.json();
  if (!withdrawalId || (decision !== "PAID" && decision !== "REJECTED")) {
    return NextResponse.json(
      { error: "withdrawalId and decision ('PAID' | 'REJECTED') are required" },
      { status: 400 }
    );
  }

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }
  if (withdrawal.status !== "REQUESTED") {
    return NextResponse.json(
      { error: `This cashout is already ${withdrawal.status}` },
      { status: 409 }
    );
  }

  if (decision === "PAID") {
    const paid = await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: "PAID", paidAt: new Date(), adminNote: note ?? null },
    });
    return NextResponse.json({ withdrawal: paid });
  }

  // Rejecting returns the money to the curator's available balance.
  const rejected = await prisma.$transaction(async (tx) => {
    await tx.curatorPayout.updateMany({
      where: { withdrawalId },
      data: { status: "AVAILABLE", withdrawalId: null },
    });
    return tx.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: "REJECTED", adminNote: note ?? null },
    });
  });

  return NextResponse.json({ withdrawal: rejected });
}
