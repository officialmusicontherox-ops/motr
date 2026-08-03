import { prisma } from "./prisma";
import { CURATORS_PER_TRACK } from "./payouts";

/**
 * Routes an approved track to a limited set of curators rather than the whole
 * pool — the artist paid for consideration by a handful of relevant people,
 * not a free-for-all.
 *
 * Genre-matched curators come first, ranked by curation weight; if there
 * aren't enough in that genre we top up from everyone else so a niche track
 * doesn't sit unreviewed forever.
 */
export async function assignCuratorsToTrack(trackId: string) {
  const track = await prisma.track.findUniqueOrThrow({ where: { id: trackId } });

  // Nothing without a paying artist behind it ever reaches a curator. The
  // seeded catalogue exists to give fans something to swipe; if one of those
  // reached a curator they'd earn a $2 fee against a submission fee that was
  // never collected. The payment chain already prevents this — only a Stripe
  // webhook can mark a track for review — but this is the last gate before
  // money is owed, so it refuses explicitly rather than relying on that.
  if (!track.artistId) {
    return { assigned: 0, alreadyAssigned: 0, blocked: "no artist attached" as const };
  }

  const existing = await prisma.curatorAssignment.count({ where: { trackId } });
  if (existing > 0) {
    return { assigned: 0, alreadyAssigned: existing };
  }

  // Only curators actually taking work — a paused or suspended curator
  // sitting on an assignment is the artist's fee buying nothing.
  const takingWork = { status: "ACTIVE" } as const;

  const matched = track.genre
    ? await prisma.user.findMany({
        where: { ...takingWork, genres: { has: track.genre } },
        orderBy: { curationWeight: "desc" },
        take: CURATORS_PER_TRACK,
        select: { id: true },
      })
    : [];

  let chosen = matched;

  if (chosen.length < CURATORS_PER_TRACK) {
    const fillers = await prisma.user.findMany({
      where: { ...takingWork, id: { notIn: chosen.map((c) => c.id) } },
      orderBy: { curationWeight: "desc" },
      take: CURATORS_PER_TRACK - chosen.length,
      select: { id: true },
    });
    chosen = [...chosen, ...fillers];
  }

  if (chosen.length === 0) {
    return { assigned: 0, alreadyAssigned: 0 };
  }

  await prisma.curatorAssignment.createMany({
    data: chosen.map((c) => ({ trackId, userId: c.id })),
    skipDuplicates: true,
  });

  return { assigned: chosen.length, alreadyAssigned: 0 };
}
