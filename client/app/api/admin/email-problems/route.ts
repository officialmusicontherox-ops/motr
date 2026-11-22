import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

/**
 * Addresses MOTR could not reach, newest first, one row per address, with
 * who it belongs to. An artist here is one whose battle links, results and
 * chart emails are not arriving.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await prisma.emailProblem.findMany({ orderBy: { createdAt: "desc" }, take: 2000 });

  const byEmail = new Map<
    string,
    { email: string; kind: string; reason: string | null; subject: string | null; last: Date; times: number }
  >();
  for (const r of rows) {
    const cur = byEmail.get(r.email);
    if (cur) cur.times += 1;
    else byEmail.set(r.email, { email: r.email, kind: r.kind, reason: r.reason, subject: r.subject, last: r.createdAt, times: 1 });
  }
  const emails = [...byEmail.keys()];

  const [artists, fans] = await Promise.all([
    prisma.artist.findMany({
      where: { email: { in: emails, mode: "insensitive" } },
      select: { email: true, name: true, emailOptOut: true, _count: { select: { tracks: { where: { status: { not: "REJECTED" } } } } } },
    }),
    prisma.fan.findMany({
      where: { email: { in: emails, mode: "insensitive" } },
      select: { email: true },
    }),
  ]);
  const artistBy = new Map(artists.map((a) => [a.email.toLowerCase(), a]));
  const fanSet = new Set(fans.map((f) => (f.email ?? "").toLowerCase()));

  return NextResponse.json({
    problems: [...byEmail.values()].map((p) => {
      const a = artistBy.get(p.email);
      return {
        email: p.email,
        kind: p.kind,
        reason: p.reason,
        subject: p.subject,
        last: p.last.toISOString(),
        times: p.times,
        who: a ? "artist" : fanSet.has(p.email) ? "listener" : "other",
        artistName: a?.name ?? null,
        liveSongs: a?._count.tracks ?? 0,
        optedOut: a?.emailOptOut ?? false,
      };
    }),
  });
}
