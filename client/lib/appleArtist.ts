import { prisma } from "@/lib/prisma";

/**
 * The Apple artist a song with no Apple match should be filed under.
 *
 * The charts, Battle Wins and the one-battle-a-week rule all recognise an
 * artist by Apple's profile id, falling back to the credited name. When one
 * song by an artist matched Apple and another did not, that made the same
 * artist two people: listed twice on a chart, and given two battles in a
 * week. So a song that arrives without an id borrows the one already on
 * file for the same credited name.
 *
 * Only when the name points at exactly one Apple artist. Two different
 * artists sharing a name is left alone rather than guessed at.
 */
export async function knownAppleArtist(
  artistName: string
): Promise<{ appleArtistId: string; appleArtistName: string | null } | null> {
  const name = artistName.trim();
  if (!name) return null;
  const rows = await prisma.track.findMany({
    where: {
      appleArtistId: { not: null },
      OR: [
        { artistName: { equals: name, mode: "insensitive" } },
        { appleArtistName: { equals: name, mode: "insensitive" } },
      ],
    },
    distinct: ["appleArtistId"],
    select: { appleArtistId: true, appleArtistName: true },
    take: 2,
  });
  if (rows.length !== 1 || !rows[0].appleArtistId) return null;
  return { appleArtistId: rows[0].appleArtistId, appleArtistName: rows[0].appleArtistName };
}
