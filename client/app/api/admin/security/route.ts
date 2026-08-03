import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { pruneLoginAttempts } from "@/lib/loginThrottle";

/**
 * Who has been trying to get into the admin portal.
 *
 * Blocking attacks isn't much use if you never learn they happened — a burst
 * of failures from one address is the signal that someone is actually
 * targeting the site rather than fat-fingering a code.
 */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await pruneLoginAttempts();

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const windowStart = new Date(Date.now() - 15 * 60 * 1000);

  const [recent, failed24h, success24h, byIp] = await Promise.all([
    prisma.adminLoginAttempt.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.adminLoginAttempt.count({ where: { success: false, createdAt: { gte: dayAgo } } }),
    prisma.adminLoginAttempt.count({ where: { success: true, createdAt: { gte: dayAgo } } }),
    // Anything currently at or over the per-IP limit is locked out right now.
    prisma.adminLoginAttempt.groupBy({
      by: ["ip"],
      where: { success: false, createdAt: { gte: windowStart } },
      _count: { _all: true },
    }),
  ]);

  const lockedOut = byIp.filter((r) => r._count._all >= 5).map((r) => r.ip);

  return NextResponse.json({
    recent,
    stats: { failed24h, success24h, lockedOut },
  });
}
