import { prisma } from "./prisma";
import { artistMatches, searchItunesAll, titleMatches } from "./trackLookup";

export type Verdict = "MATCH" | "MISMATCH" | "UNVERIFIED";

export type IdentityCheck = {
  verdict: Verdict;
  /** What the stored audio actually is, when we could identify it. */
  actual: { title: string; artistName: string } | null;
};

/**
 * Is the audio behind this track really the recording it claims to be?
 *
 * Playability was the only thing ever checked, and a track that plays the
 * wrong song passes that test perfectly — artwork, title, play button, sound.
 * The artist is the one who finds out.
 *
 * The check works backwards from the stored preview URL: search Apple, find
 * the result carrying that exact URL, and see whether its title and artist
 * agree with what we filed it under. If Apple's search can't surface it at
 * all the answer is UNVERIFIED, which is genuinely different from wrong —
 * small artists are frequently unsearchable even when the audio is right.
 */
export async function checkAudioIdentity(track: {
  title: string;
  artistName: string;
  previewUrl: string;
}): Promise<IdentityCheck> {
  const terms = [`${track.artistName} ${track.title}`, `${track.title} ${track.artistName}`];

  for (const term of terms) {
    const results = await searchItunesAll(term, 25).catch(() => []);
    const found = results.find((r) => r.previewUrl === track.previewUrl);
    if (!found) continue;

    const ok =
      artistMatches(track.artistName, found.artistName) &&
      titleMatches(track.title, found.trackName);

    return {
      verdict: ok ? "MATCH" : "MISMATCH",
      actual: { title: found.trackName, artistName: found.artistName },
    };
  }

  return { verdict: "UNVERIFIED", actual: null };
}

/**
 * Verifies a slice of the feed and records what it found.
 *
 * Capped per run on purpose: Apple throttles at roughly twenty searches a
 * minute, so a sweep of the whole catalogue in one request would be throttled
 * halfway through and report nonsense. Tracks already carrying a verdict for
 * their current audio are skipped, so repeated runs work through the backlog
 * and then cost almost nothing.
 *
 * Artist submissions first, always. Wrong audio on seeded catalogue is
 * embarrassing; wrong audio under a real artist's name is the thing that
 * loses them.
 */
export async function verifyFeedIdentity(limit = 12) {
  const due = await prisma.track.findMany({
    where: { audioVerdict: null, status: { in: ["DISCOVERY", "VETTING", "GRADUATED"] } },
    select: { id: true, title: true, artistName: true, previewUrl: true, artistId: true },
    orderBy: [{ artistId: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit,
  });

  const mismatches: {
    id: string;
    title: string;
    artistName: string;
    actualTitle: string;
    actualArtist: string;
  }[] = [];
  let matched = 0;
  let unverified = 0;

  for (const t of due) {
    const { verdict, actual } = await checkAudioIdentity(t);

    await prisma.track.update({
      where: { id: t.id },
      data: { audioVerdict: verdict, audioCheckedAt: new Date() },
    });

    if (verdict === "MISMATCH" && actual) {
      mismatches.push({
        id: t.id,
        title: t.title,
        artistName: t.artistName,
        actualTitle: actual.title,
        actualArtist: actual.artistName,
      });
    } else if (verdict === "MATCH") {
      matched += 1;
    } else {
      unverified += 1;
    }
  }

  const remaining = await prisma.track.count({
    where: { audioVerdict: null, status: { in: ["DISCOVERY", "VETTING", "GRADUATED"] } },
  });

  return { checkedNow: due.length, matched, unverified, mismatches, remaining };
}

/** Every mismatch on record, so the dashboard shows old findings too. */
export async function knownMismatches() {
  return prisma.track.findMany({
    where: { audioVerdict: "MISMATCH" },
    select: { id: true, title: true, artistName: true, previewUrl: true },
    orderBy: { audioCheckedAt: "desc" },
  });
}
