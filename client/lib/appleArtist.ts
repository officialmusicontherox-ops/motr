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

/**
 * The other direction. A song has just arrived with an Apple artist, and
 * the same name may already have older songs filed under the name alone
 * because Apple could not place them at the time. Move those onto the id,
 * or the artist is split again the moment their second song matches.
 */
export async function adoptAppleArtist(
  appleArtistId: string,
  appleArtistName: string | null,
  artistName: string
): Promise<number> {
  const names = [artistName, appleArtistName].filter((n): n is string => !!n && !!n.trim());
  if (!names.length) return 0;
  const done = await prisma.track.updateMany({
    where: {
      appleArtistId: null,
      OR: names.map((n) => ({ artistName: { equals: n.trim(), mode: "insensitive" as const } })),
    },
    data: { appleArtistId, appleArtistName },
  });
  return done.count;
}
