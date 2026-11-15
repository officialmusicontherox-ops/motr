import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { battleLeadersBetween, battleTotals, pairThisWeek, settleFinishedWeeks } from "@/lib/battles";
import { weekOf } from "@/lib/weekWindow";

/**
 * The full battle record, for the admin panel.
 *
 * The public screens show percentages and ranks. This is the ledger behind
 * them: this week's battles with their real vote counts and links, how many
 * votes came in by shared link, and every artist's all-time record.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The same housekeeping a listener's visit does, so this page is never
  // looking at a week nobody has opened yet.
  await settleFinishedWeeks();
  await pairThisWeek();

  const week = weekOf();
  const [battles, votes, skips, shared, voters, totals, leaders, closed] = await Promise.all([
    prisma.battle.findMany({ where: { weekStart: week.start }, orderBy: { createdAt: "asc" } }),
    prisma.battleVote.count({ where: { pick: { not: "SKIP" } } }),
    prisma.battleVote.count({ where: { pick: "SKIP" } }),
    prisma.battleVote.count({ where: { viaShare: true, pick: { not: "SKIP" } } }),
    prisma.battleVote
      .groupBy({ by: ["fanId"], where: { pick: { not: "SKIP" } } })
      .then((r) => r.length),
    battleTotals(300),
    battleLeadersBetween(week.start, week.end, 25),
    prisma.battle.count({ where: { settledAt: { not: null } } }),
  ]);

  const ids = [...new Set(battles.flatMap((b) => [b.trackAId, b.trackBId]))];
  const tracks = await prisma.track.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, artistName: true },
  });
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const name = (id: string) => {
    const t = byId.get(id);
    return t ? `${t.artistName} · ${t.title}` : "(removed)";
  };

  // Shared-link votes per battle this week, in one read.
  const sharedRows = await prisma.battleVote.groupBy({
    by: ["battleId"],
    where: { battleId: { in: battles.map((b) => b.id) }, viaShare: true, pick: { not: "SKIP" } },
    _count: true,
  });
  const sharedBy = new Map(sharedRows.map((r) => [r.battleId, r._count]));

  return NextResponse.json({
    weekLabel: week.label,
    counts: { votes, skips, shared, voters, open: battles.length, closed },
    thisWeek: battles
      .map((b) => ({
        id: b.id,
        genre: b.genre,
        a: name(b.trackAId),
        b: name(b.trackBId),
        votesA: b.votesA,
        votesB: b.votesB,
        shared: sharedBy.get(b.id) ?? 0,
      }))
      .sort((x, y) => y.votesA + y.votesB - (x.votesA + x.votesB)),
    leaders,
    totals,
  });
}
