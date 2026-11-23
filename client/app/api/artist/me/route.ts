import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/artistAuth";
import { FULL_LISTEN_MS } from "@/lib/discovery";
import { leadersBetween, SONGS_PER_ARTIST } from "@/lib/scoutData";
import { weekOf } from "@/lib/weekWindow";
import { battleWeek } from "@/lib/battles";

/**
 * Everything an artist's own page shows.
 *
 * The artist id comes from the signed cookie, never from the request, so
 * there is no parameter anyone could change to read somebody else's numbers.
 *
 * Their songs with saves, full listens and link opens; which of them count
 * toward this week's chart; their place on Top Artists if they have one;
 * this week's battle and their Battle Wins. Their own numbers only, and
 * nobody else's: no opponent's votes, no other artist's figures.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireArtist();
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const tracks = await prisma.track.findMany({
    where: { artistId: session.artistId, status: { not: "REJECTED" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      shareOpens: true,
      fanRightSwipes: true,
      aiGenerated: true,
      battleWins: true,
      createdAt: true,
    },
  });
  const ids = tracks.map((t) => t.id);
  const week = weekOf();
  const bWeek = battleWeek();

  const [fullListens, thisWeek, leaders, battles] = await Promise.all([
    // Listeners who heard the whole clip before deciding.
    ids.length
      ? prisma.fanSwipe.groupBy({
          by: ["trackId"],
          where: { trackId: { in: ids }, listenMs: { gte: FULL_LISTEN_MS } },
          _count: { _all: true },
        })
      : [],
    // This week's weighted saves per song, to show which two are counting.
    ids.length
      ? prisma.fanSwipe.groupBy({
          by: ["trackId"],
          where: { trackId: { in: ids }, direction: "RIGHT", createdAt: { gte: week.start, lt: week.end } },
          _sum: { weight: true },
          _count: { _all: true },
        })
      : [],
    leadersBetween(week.start, week.end),
    ids.length
      ? prisma.battle.findMany({
          where: {
            weekStart: bWeek.start,
            cancelledAt: null,
            OR: [{ trackAId: { in: ids } }, { trackBId: { in: ids } }],
          },
          select: { id: true, trackAId: true, trackBId: true, settledAt: true, winnerId: true },
        })
      : [],
  ]);

  const full = new Map(fullListens.map((r) => [r.trackId, r._count._all]));
  const weekScore = new Map(thisWeek.map((r) => [r.trackId, r._sum.weight ?? 0]));
  const weekSaves = new Map(thisWeek.map((r) => [r.trackId, r._count._all]));

  // Their best two this week, by the same weighted count the chart uses.
  const counting = new Set(
    [...weekScore.entries()]
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, SONGS_PER_ARTIST)
      .map(([id]) => id)
  );

  const place = leaders.artists.findIndex((a) => a.artistId === session.artistId);
  const titleOf = new Map(tracks.map((t) => [t.id, t.title]));

  return NextResponse.json({
    name: session.name,
    email: session.email,
    week: week.label,
    chartPlace: place >= 0 ? place + 1 : null,
    battleWins: tracks.reduce((n, t) => n + t.battleWins, 0),
    battles: battles.map((b) => {
      const mine = ids.includes(b.trackAId) ? b.trackAId : b.trackBId;
      return {
        url: `https://app.musicontherox.com/battles?b=${b.id}`,
        title: titleOf.get(mine) ?? "",
        closes: bWeek.label.split(" - ")[1],
        // Only once decided early by a forfeit; otherwise voting is open.
        result: b.settledAt ? (b.winnerId === mine ? "won" : b.winnerId ? "lost" : "tie") : null,
      };
    }),
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      opens: t.shareOpens,
      saves: t.fanRightSwipes,
      fullListens: full.get(t.id) ?? 0,
      savesThisWeek: weekSaves.get(t.id) ?? 0,
      counting: counting.has(t.id),
      ai: t.aiGenerated === true,
      addedAt: t.createdAt.toISOString(),
    })),
  });
}
