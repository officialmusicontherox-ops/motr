import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { battleHousekeeping, battleLeadersBetween, battleTotals, battleWeek } from "@/lib/battles";

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
  await battleHousekeeping();

  const week = battleWeek();
  const [battles, votes, skips, shared, voters, totals, leaders, closed] = await Promise.all([
    prisma.battle.findMany({ where: { weekStart: week.start, cancelledAt: null }, orderBy: { createdAt: "asc" } }),
    prisma.battleVote.count({ where: { pick: { not: "SKIP" } } }),
    prisma.battleVote.count({ where: { pick: "SKIP" } }),
    prisma.battleVote.count({ where: { viaShare: true, pick: { not: "SKIP" } } }),
    prisma.battleVote
      .groupBy({ by: ["fanId"], where: { pick: { not: "SKIP" } } })
      .then((r) => r.length),
    battleTotals(300),
    battleLeadersBetween(week.start, week.end, 25),
    prisma.battle.count({ where: { settledAt: { not: null }, cancelledAt: null } }),
  ]);
  const cancelled = await prisma.battle.count({ where: { cancelledAt: { not: null } } });

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

  // Who is not in a battle this week, and why. Pairing takes one song per
  // artist within a genre (AI vocals in a group of their own), so an artist
  // waits when they are alone in their group or their group came out odd.
  // Read the same way pairing reads it, so this answers "why isn't my song
  // in a battle?" before the email arrives.
  const eligible = await prisma.track.findMany({
    where: { status: "DISCOVERY", artistId: { not: null }, genre: { not: null } },
    select: {
      artistName: true,
      appleArtistId: true,
      appleArtistName: true,
      genre: true,
      aiGenerated: true,
      battles: true,
      artist: { select: { email: true } },
    },
  });
  const keyOf = (t: { appleArtistId: string | null; artistName: string }) =>
    t.appleArtistId ?? `name:${t.artistName}`;
  const chosen = new Map<string, (typeof eligible)[number]>();
  for (const t of eligible) {
    const cur = chosen.get(keyOf(t));
    if (!cur || t.battles < cur.battles) chosen.set(keyOf(t), t);
  }
  const groupOf = (t: (typeof eligible)[number]) => `${t.genre}|${t.aiGenerated ? "ai" : "human"}`;
  const groupSize = new Map<string, number>();
  for (const t of chosen.values()) groupSize.set(groupOf(t), (groupSize.get(groupOf(t)) ?? 0) + 1);

  const inBattle = new Set<string>();
  const battleTracks = await prisma.track.findMany({
    where: { id: { in: ids } },
    select: { artistName: true, appleArtistId: true },
  });
  for (const t of battleTracks) inBattle.add(keyOf(t));

  const waiting = [...chosen.entries()]
    .filter(([k]) => !inBattle.has(k))
    .map(([, t]) => ({
      name: t.appleArtistName ?? t.artistName,
      genre: (t.genre ?? "").split(" /")[0],
      ai: !!t.aiGenerated,
      account: t.artist?.email ?? null,
      reason:
        (groupSize.get(groupOf(t)) ?? 0) <= 1
          ? `The only ${t.aiGenerated ? "AI-vocal " : ""}artist in ${(t.genre ?? "").split(" /")[0]} right now`
          : `${(t.genre ?? "").split(" /")[0]}${t.aiGenerated ? " (AI vocals)" : ""} had an odd number of artists this week`,
    }))
    .sort((a, b) => a.genre.localeCompare(b.genre) || a.name.localeCompare(b.name));

  return NextResponse.json({
    waiting,
    weekLabel: week.label,
    counts: { votes, skips, shared, voters, open: battles.length, closed, cancelled },
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
