import { prisma } from "./prisma";

/**
 * The last word on whether an address may be mailed.
 *
 * Every bulk sender filters on emailOptOut already, and that is still where
 * it should happen: filtering is cheaper than sending and then refusing. This
 * exists because "every sender" is a promise no codebase keeps. One added
 * later without the filter, or one whose query drifts, puts mail in front of
 * somebody who asked not to get any, and the person who finds out is them.
 *
 * Transactional mail is exempt and must say so at the call site. A sign-in
 * link somebody has just asked for is not marketing, and blocking it would
 * lock an artist out of the account they are trying to come back to.
 */
export async function isSuppressed(email: string): Promise<boolean> {
  const address = email.trim();
  if (!address) return false;

  const [artist, fan] = await Promise.all([
    prisma.artist.findFirst({
      where: { email: { equals: address, mode: "insensitive" }, emailOptOut: true },
      select: { id: true },
    }),
    prisma.fan.findFirst({
      where: { email: { equals: address, mode: "insensitive" }, emailOptOut: true },
      select: { id: true },
    }),
  ]);

  return Boolean(artist || fan);
}
