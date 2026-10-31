import { prisma } from "./prisma";

/**
 * Coming off the email list, and what that means for an artist.
 *
 * An artist's email is the only way the platform reaches them: how a chart
 * placing, a refusal or a takedown request gets through. Staying in rotation
 * while refusing all of it is not something we can run, so an artist who
 * unsubscribes has their music pulled with them.
 *
 * Pulled, not deleted. The rows stay and carry a flag saying why they went,
 * so putting someone back is one step rather than a rebuild.
 */

/** Opt an artist out and take their music out of rotation with them. */
export async function optOutArtist(artistId: string, by: "link" | "admin") {
  const [, pulled] = await prisma.$transaction([
    prisma.artist.update({
      where: { id: artistId },
      data: { emailOptOut: true, emailOptOutAt: new Date(), emailOptOutBy: by },
    }),
    prisma.track.updateMany({
      where: { artistId, status: { not: "REJECTED" } },
      data: { status: "REJECTED", removedForOptOut: true },
    }),
  ]);
  return { tracksPulled: pulled.count };
}

/** Put an artist back on, and restore only what the opt-out took. */
export async function optInArtist(artistId: string) {
  const [, restored] = await prisma.$transaction([
    prisma.artist.update({
      where: { id: artistId },
      data: { emailOptOut: false, emailOptOutAt: null, emailOptOutBy: null },
    }),
    // Only tracks this flag marks: anything a human rejected on merit stays
    // rejected.
    prisma.track.updateMany({
      where: { artistId, removedForOptOut: true },
      data: { status: "DISCOVERY", removedForOptOut: false },
    }),
  ]);
  return { tracksRestored: restored.count };
}

/** A listener coming off. Nothing else changes for them. */
export async function optOutFan(fanId: string, by: "link" | "admin") {
  await prisma.fan.update({
    where: { id: fanId },
    data: { emailOptOut: true, emailOptOutAt: new Date(), emailOptOutBy: by },
  });
}

export async function optInFan(fanId: string) {
  await prisma.fan.update({
    where: { id: fanId },
    data: { emailOptOut: false, emailOptOutAt: null, emailOptOutBy: null },
  });
}
