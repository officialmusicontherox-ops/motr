import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { settleMaturedPayouts } from "@/lib/payouts";

const STATUSES = ["ACTIVE", "PAUSED", "SUSPENDED", "REMOVED"] as const;
type Status = (typeof STATUSES)[number];

/**
 * Everything you need to judge and manage one curator, in one row: what they
 * told us on their application, what they've actually done since, and what
 * they're owed.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Balances are only correct once matured payouts have been settled.
  await settleMaturedPayouts();

  const filter = req.nextUrl.searchParams.get("status");
  const where = STATUSES.includes(filter as Status)
    ? { status: filter as Status }
    : { status: { not: "REMOVED" as Status } };

  const curators = await prisma.user.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { assignments: true, payouts: true, withdrawals: true } },
    },
  });

  const ids = curators.map((c) => c.id);

  // Grouped queries rather than per-curator lookups, so the page doesn't
  // fan out into N+1 round trips as the roster grows.
  const [payoutRows, assignmentRows, featureRows, applications] = await Promise.all([
    prisma.curatorPayout.groupBy({
      by: ["userId", "status"],
      where: { userId: { in: ids } },
      _sum: { amountCents: true },
    }),
    prisma.curatorAssignment.groupBy({
      by: ["userId", "status"],
      where: { userId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.feature.groupBy({
      by: ["status"],
      where: { assignment: { userId: { in: ids } } },
      _count: { _all: true },
    }),
    prisma.curatorApplication.findMany({
      where: { createdUserId: { in: ids } },
      select: { createdUserId: true, pitch: true, createdAt: true },
    }),
  ]);

  const pitchByUser = new Map(applications.map((a) => [a.createdUserId, a.pitch]));

  const rows = curators.map((c) => {
    const money = { held: 0, available: 0, withdrawn: 0 };
    for (const p of payoutRows.filter((p) => p.userId === c.id)) {
      const cents = p._sum.amountCents ?? 0;
      if (p.status === "HELD") money.held = cents;
      if (p.status === "AVAILABLE") money.available = cents;
      if (p.status === "WITHDRAWN") money.withdrawn = cents;
    }

    const work = { pending: 0, featured: 0, passed: 0, expired: 0 };
    for (const a of assignmentRows.filter((a) => a.userId === c.id)) {
      const n = a._count._all;
      if (a.status === "PENDING") work.pending = n;
      if (a.status === "FEATURED") work.featured = n;
      if (a.status === "PASSED") work.passed = n;
      if (a.status === "EXPIRED") work.expired = n;
    }

    const decided = work.featured + work.passed;

    return {
      id: c.id,
      username: c.username,
      email: c.email,
      status: c.status,
      statusNote: c.statusNote,
      statusChangedAt: c.statusChangedAt,
      joinedAt: c.createdAt,

      outletName: c.outletName,
      outletType: c.outletType,
      outletUrl: c.outletUrl,
      audienceSize: c.audienceSize,
      socialLinks: c.socialLinks,
      genres: c.genres,
      country: c.country,
      payoutDestination: c.payoutDestination,
      pitch: pitchByUser.get(c.id) ?? null,

      work,
      // How much of what they're sent they actually act on — the single most
      // useful number for spotting a curator who's gone quiet.
      responseRate: decided + work.pending > 0 ? decided / (decided + work.pending) : null,
      featureRate: decided > 0 ? work.featured / decided : null,

      earnings: money,
      totalEarnedCents: money.held + money.available + money.withdrawn,
      withdrawals: c._count.withdrawals,
    };
  });

  const featureTotals = Object.fromEntries(featureRows.map((f) => [f.status, f._count._all]));

  return NextResponse.json({ curators: rows, featureTotals });
}

/**
 * Status changes. Nothing here deletes a row: payouts, withdrawals and past
 * assignments reference the curator, and financial history has to survive.
 */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, status, note, email, payoutDestination } = await req.json().catch(() => ({}));

  /**
   * Set where a curator gets paid.
   *
   * Separate from their sign-in address on purpose — Blue Radio signs in with
   * a Gmail account and is paid at their outlet's own domain, which is the
   * normal shape for an outlet rather than an exception. Curators can set
   * this themselves on their earnings page; this is for when they'd rather
   * just tell you.
   */
  if (typeof payoutDestination === "string" && payoutDestination.trim()) {
    const next = payoutDestination.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
    }
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { payoutDestination: next },
      select: { id: true, username: true, payoutDestination: true },
    });
    return NextResponse.json({ curator: user });
  }

  /**
   * Change the address a curator signs in with.
   *
   * Sign-in is Google, and a curator applies with their outlet's contact
   * address — which for a radio show or a podcast is usually a custom domain
   * with no Google account behind it. They then can't get in at all, and the
   * only fix was editing the database by hand.
   *
   * The application row is moved too, so "Resend welcome" doesn't mail the
   * address they can't use.
   */
  if (typeof email === "string" && email.trim()) {
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const clash = await prisma.user.findFirst({
      where: { email: { equals: next, mode: "insensitive" }, NOT: { id: userId } },
      select: { username: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `${next} is already the sign-in for ${clash.username}.` },
        { status: 409 }
      );
    }

    const before = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!before) return NextResponse.json({ error: "Curator not found" }, { status: 404 });

    const user = await prisma.user.update({ where: { id: userId }, data: { email: next } });
    await prisma.curatorApplication.updateMany({
      where: { email: { equals: before.email, mode: "insensitive" } },
      data: { email: next },
    });

    return NextResponse.json({ curator: { id: user.id, email: user.email }, was: before.email });
  }

  if (!userId || !STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `userId and status (${STATUSES.join(" | ")}) are required` },
      { status: 400 }
    );
  }

  const curator = await prisma.user.findUnique({ where: { id: userId } });
  if (!curator) {
    return NextResponse.json({ error: "Curator not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        status,
        statusNote: typeof note === "string" && note.trim() ? note.trim() : null,
        statusChangedAt: new Date(),
      },
    });

    // Taking someone out of rotation has to release the tracks they're
    // sitting on, or an artist's submission stalls on a curator who will
    // never open it.
    let released = 0;
    if (status === "SUSPENDED" || status === "REMOVED") {
      const r = await tx.curatorAssignment.updateMany({
        where: { userId, status: "PENDING" },
        data: { status: "EXPIRED", decidedAt: new Date() },
      });
      released = r.count;
    }

    return { user, released };
  });

  return NextResponse.json({
    curator: { id: updated.user.id, status: updated.user.status },
    releasedAssignments: updated.released,
  });
}
