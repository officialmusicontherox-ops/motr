import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only what the dashboard reads. It used to also count curators, their
  // swipes, their payouts, their applications, their playlist placements and
  // their withdrawals -- nine queries on every load, for numbers nothing has
  // rendered since the curator programme was retired.
  const [fanCount, artistCount, tracksByStatus, fanSwipeCount, revenue, recentNotifications] =
    await Promise.all([
      prisma.fan.count(),
      prisma.artist.count(),
      prisma.track.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.fanSwipe.count(),
      prisma.payment.aggregate({
        where: { status: "PAID" },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
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
      artists: artistCount,
      fanSwipes: fanSwipeCount,
    },
    tracksByStatus: statusCounts,
    revenue: {
      totalCents: revenue._sum.amountCents ?? 0,
      paidCount: revenue._count._all,
    },
    recentNotifications,
  });
}
