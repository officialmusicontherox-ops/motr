import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    fanCount,
    curatorCount,
    artistCount,
    tracksByStatus,
    fanSwipeCount,
    curatorSwipeCount,
    revenue,
    pendingPayouts,
    releasedPayouts,
    awaitingPayment,
    pendingSubmissions,
    pendingApplications,
    pendingFeatures,
    pendingWithdrawals,
    recentNotifications,
  ] = await Promise.all([
    prisma.fan.count(),
    prisma.user.count(),
    prisma.artist.count(),
    prisma.track.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.fanSwipe.count(),
    prisma.swipe.count(),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.curatorPayout.aggregate({
      where: { status: { in: ["HELD", "AVAILABLE"] } },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.curatorPayout.aggregate({
      where: { status: "WITHDRAWN" },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.track.count({ where: { feeStatus: "PENDING" } }),
    prisma.track.count({ where: { reviewStatus: "PENDING" } }),
    prisma.curatorApplication.count({ where: { status: "PENDING" } }),
    prisma.feature.count({ where: { status: "SUBMITTED" } }),
    prisma.withdrawal.count({ where: { status: "REQUESTED" } }),
    prisma.artistNotification.findMany({
      take: 10,
      orderBy: { sentAt: "desc" },
      include: { track: { select: { title: true, artistName: true } } },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of tracksByStatus) statusCounts[row.status] = row._count._all;

  return NextResponse.json({
    counts: {
      fans: fanCount,
      curators: curatorCount,
      artists: artistCount,
      fanSwipes: fanSwipeCount,
      curatorSwipes: curatorSwipeCount,
      awaitingPayment,
      pendingSubmissions,
      pendingApplications,
      pendingFeatures,
      pendingWithdrawals,
    },
    tracksByStatus: statusCounts,
    revenue: {
      totalCents: revenue._sum.amountCents ?? 0,
      paidCount: revenue._count._all,
    },
    payouts: {
      // Earned but not yet cashed out (held + available).
      owedCents: pendingPayouts._sum.amountCents ?? 0,
      owedCount: pendingPayouts._count._all,
      paidOutCents: releasedPayouts._sum.amountCents ?? 0,
      paidOutCount: releasedPayouts._count._all,
    },
    recentNotifications,
  });
}
