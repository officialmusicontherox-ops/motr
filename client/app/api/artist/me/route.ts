import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/artistAuth";
import { leadersBetween, SONGS_PER_ARTIST } from "@/lib/scoutData";
import { weekOf } from "@/lib/weekWindow";
import { battleWeek } from "@/lib/battles";

/**
 * Everything an artist's own page shows.
 *
 * The artist id comes from the signed cookie, never from the request, so
 * there is no parameter anyone could change to read somebody else's numbers.
 *
 * Their songs and which of them count toward this week's charts; their place
 * on Top Artists and on AI Artists if they have one; this week's battle and
 * their Battle Wins.
 *
 * No save, listen or link-open counts. Not shown on the page, and not sent
 * at all, so they cannot be read from the browser either. Nobody else's
 * figures: no opponent's votes, no other artist's numbers.
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
      aiGenerated: true,
      genre: true,
      battleWins: true,
      createdAt: true,
    },
  });
  const ids = tracks.map((t) => t.id);
  const week = weekOf();
  const bWeek = battleWeek();

  // Spotlights listeners have put them in. Whether one is up now, whether
  // another is waiting, and how many in all. Never who bought them, and
  // never how long is left.
  const now = new Date();
  const [spotlightLive, spotlightQueued, spotlightTotal] = await Promise.all([
    prisma.spotlight.count({ where: { artistId: session.artistId, startsAt: { lte: now }, endsAt: { gt: now } } }),
    prisma.spotlight.count({ where: { artistId: session.artistId, startsAt: null } }),
    prisma.spotlight.count({ where: { artistId: session.artistId } }),
  ]);

  const pendingChanges = ids.length
    ? await prisma.trackChangeRequest.findMany({ where: { trackId: { in: ids }, status: "PENDING" } })
    : [];
  const pendingBy = new Map(pendingChanges.map((p) => [p.trackId, p]));

  const [thisWeek, leaders, battles] = await Promise.all([
    // This week's weighted saves per song, to show which two are counting.
    ids.length
      ? prisma.fanSwipe.groupBy({
          by: ["trackId"],
          where: { trackId: { in: ids }, direction: "RIGHT", createdAt: { gte: week.start, lt: week.end } },
          _sum: { weight: true },
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

  const weekScore = new Map(thisWeek.map((r) => [r.trackId, r._sum.weight ?? 0]));

  // Their best two this week on each kind, by the same weighted count the
  // chart uses. They appear on one chart only: whichever kind adds up to
  // more this week, ties going to Top Artists, and only that chart's two
  // songs are counting. With no saves yet, the chart their songs mostly sit
  // on, so the page has something to say on a Sunday.
  const isAi = new Map(tracks.map((t) => [t.id, t.aiGenerated === true]));
  const bestTwo = (ai: boolean) =>
    [...weekScore.entries()]
      .filter(([id, s]) => s > 0 && isAi.get(id) === ai)
      .sort((a, b) => b[1] - a[1])
      .slice(0, SONGS_PER_ARTIST);
  const sum = (xs: [string, number][]) => xs.reduce((n, [, v]) => n + v, 0);
  const reg = bestTwo(false);
  const ai = bestTwo(true);
  const anySaves = reg.length + ai.length > 0;
  const aiSongs = tracks.filter((t) => t.aiGenerated === true).length;
  const chart: "regular" | "ai" = anySaves
    ? sum(ai) > sum(reg)
      ? "ai"
      : "regular"
    : aiSongs > tracks.length - aiSongs
      ? "ai"
      : "regular";
  const counting = new Set((chart === "ai" ? ai : reg).map(([id]) => id));

  const placeOn = (list: { artistId: string }[]) => {
    const i = list.findIndex((a) => a.artistId === session.artistId);
    return i >= 0 ? i + 1 : null;
  };
  const titleOf = new Map(tracks.map((t) => [t.id, t.title]));

  return NextResponse.json({
    name: session.name,
    email: session.email,
    week: week.label,
    // Their place on each chart this week, or null where they are not in
    // its top ten.
    // The one chart they are on this week, and their place on it, or null
    // if they are not in its top ten.
    chart,
    chartPlace: placeOn(chart === "ai" ? leaders.aiArtists : leaders.artists),
    battleWins: tracks.reduce((n, t) => n + t.battleWins, 0),
    spotlight: { live: spotlightLive > 0, queued: spotlightQueued > 0, total: spotlightTotal },
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
      counting: counting.has(t.id),
      ai: t.aiGenerated === true,
      genre: t.genre,
      aiGenerated: t.aiGenerated,
      // A change they asked for that is waiting on the admin.
      pending: pendingBy.has(t.id)
        ? { genre: pendingBy.get(t.id)!.genre, aiGenerated: pendingBy.get(t.id)!.aiGenerated }
        : null,
      addedAt: t.createdAt.toISOString(),
    })),
  });
}
