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

  const existing = await prisma.curatorAssignment.count({ where: { trackId } });
  if (existing > 0) {
    return { assigned: 0, alreadyAssigned: existing };
  }

  const matched = track.genre
    ? await prisma.user.findMany({
        where: { genres: { has: track.genre } },
        orderBy: { curationWeight: "desc" },
        take: CURATORS_PER_TRACK,
        select: { id: true },
      })
    : [];

  let chosen = matched;

  if (chosen.length < CURATORS_PER_TRACK) {
    const fillers = await prisma.user.findMany({
      where: { id: { notIn: chosen.map((c) => c.id) } },
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
