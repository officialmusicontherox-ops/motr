import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { battleLeadersBetween, battleTotals } from "@/lib/battles";
import { weekOf } from "@/lib/weekWindow";

/**
 * The full battle record, for the admin panel.
 *
 * The public chart shows rank and name over a week or a month. This is the
 * complete ledger behind it: every artist's all-time wins and appearances,
 * this week's counts, and the latest battles as they were decided.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const week = weekOf();

  const [decided, skipped, open, voters, totals, thisWeek, recent] = await Promise.all([
    prisma.battle.count({ where: { winnerId: { not: null } } }),
    prisma.battle.count({ where: { winnerId: null, decidedAt: { not: null } } }),
    prisma.battle.count({ where: { decidedAt: null } }),
    prisma.battle
      .groupBy({ by: ["fanId"], where: { winnerId: { not: null } } })
      .then((r) => r.length),
    battleTotals(300),
    battleLeadersBetween(week.start, week.end, 25),
    prisma.battle.findMany({
      where: { decidedAt: { not: null } },
      orderBy: { decidedAt: "desc" },
      take: 40,
    }),
  ]);

  // Names for the latest battles, in one read.
  const ids = [...new Set(recent.flatMap((b) => [b.trackAId, b.trackBId]))];
  const tracks = await prisma.track.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, artistName: true },
  });
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const name = (id: string) => {
    const t = byId.get(id);
    return t ? `${t.artistName} · ${t.title}` : "(removed)";
  };

  return NextResponse.json({
    weekLabel: week.label,
    counts: { decided, skipped, open, voters },
    totals,
    thisWeek,
    recent: recent.map((b) => ({
      id: b.id,
      at: b.decidedAt,
      genre: b.genre,
      a: name(b.trackAId),
      b: name(b.trackBId),
      winner: b.winnerId === b.trackAId ? "A" : b.winnerId === b.trackBId ? "B" : null,
    })),
  });
}
