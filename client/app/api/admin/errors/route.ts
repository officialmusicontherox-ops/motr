import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { pruneErrors } from "@/lib/errorLog";

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Opportunistic cleanup — no cron needed for a table this small.
  await pruneErrors();

  const view = req.nextUrl.searchParams.get("view") ?? "open";
  const where = view === "resolved" ? { resolved: true } : view === "all" ? {} : { resolved: false };

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [errors, open, resolved, last24h] = await Promise.all([
    prisma.errorLog.findMany({ where, orderBy: { lastSeen: "desc" }, take: 100 }),
    prisma.errorLog.count({ where: { resolved: false } }),
    prisma.errorLog.count({ where: { resolved: true } }),
    prisma.errorLog.aggregate({
      where: { lastSeen: { gte: dayAgo } },
      _sum: { count: true },
    }),
  ]);

  return NextResponse.json({
    errors,
    counts: { open, resolved, last24h: last24h._sum.count ?? 0 },
  });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action } = await req.json().catch(() => ({}));

  if (action === "CLEAR_RESOLVED") {
    const r = await prisma.errorLog.deleteMany({ where: { resolved: true } });
    return NextResponse.json({ deleted: r.count });
  }

  if (!id || (action !== "RESOLVE" && action !== "REOPEN" && action !== "DELETE")) {
    return NextResponse.json(
      { error: "id and action ('RESOLVE' | 'REOPEN' | 'DELETE'), or action 'CLEAR_RESOLVED'" },
      { status: 400 }
    );
  }

  if (action === "DELETE") {
    await prisma.errorLog.delete({ where: { id } }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const updated = await prisma.errorLog.update({
    where: { id },
    data: { resolved: action === "RESOLVE" },
  });

  return NextResponse.json({ error: updated });
}
