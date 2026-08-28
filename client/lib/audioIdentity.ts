import type { TrackStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { artistMatches, searchItunesChecked, titleMatches } from "./trackLookup";

export type Verdict = "MATCH" | "MISMATCH" | "UNVERIFIED";

/** Apple takes plenty of ids at once; this stays well inside what it allows. */
const LOOKUP_BATCH = 150;

/**
 * How many *searches* one run may make. Lookups are batched and effectively
 * free; searches are throttled at roughly twenty a minute, so this is the only
 * thing that still has to be rationed.
 */
const SEARCH_BUDGET = 10;

/** The statuses a track can be in and still be playing to somebody. */
const CHECKED_STATUSES: TrackStatus[] = ["DISCOVERY", "VETTING", "GRADUATED"];

/**
 * Verifies many tracks in one request, using Apple's lookup endpoint.
 *
 * Searching costs one throttled request per track — twenty a minute — which
 * is why a full library check was never possible and the button could only
 * ever nibble at the backlog. Looking up by id costs one request per hundred
 * and fifty, so the whole library is a couple of calls.
 *
 * Only works for tracks whose Apple id we already know; the search path below
 * learns it the first time a track is verified.
 */
async function verifyByLookup(
  tracks: { id: string; title: string; artistName: string; previewUrl: string; appleTrackId: string | null }[]
) {
  const known = tracks.filter((t) => t.appleTrackId);
  const results = new Map<string, IdentityCheck>();

  for (let i = 0; i < known.length; i += LOOKUP_BATCH) {
    const batch = known.slice(i, i + LOOKUP_BATCH);
    const ids = batch.map((t) => t.appleTrackId).join(",");
    const data = await fetch(`https://itunes.apple.com/lookup?id=${ids}&entity=song`)
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .catch(() => ({ results: [] }));

    const byId = new Map<string, { trackName?: string; artistName?: string; previewUrl?: string }>();
    for (const r of data.results ?? []) {
      if (r.trackId) byId.set(String(r.trackId), r);
    }

    for (const t of batch) {
      const hit = byId.get(t.appleTrackId!);
      if (!hit?.trackName || !hit.artistName) {
        // Apple no longer returns it — the release may have been pulled.
        results.set(t.id, { verdict: "UNVERIFIED", actual: null });
        continue;
      }
      const ok =
        artistMatches(t.artistName, hit.artistName) && titleMatches(t.title, hit.trackName);
      results.set(t.id, {
        verdict: ok ? "MATCH" : "MISMATCH",
        actual: { title: hit.trackName, artistName: hit.artistName },
      });
    }
  }

  return results;
}

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
}): Promise<IdentityCheck & { appleTrackId?: string; throttled?: boolean }> {
  const terms = [`${track.artistName} ${track.title}`, `${track.title} ${track.artistName}`];

  for (const term of terms) {
    const { results, throttled } = await searchItunesChecked(term, 25);
    // Apple stonewalling isn't evidence about this track. Say so, so the
    // caller leaves the verdict blank and tries again later instead of
    // recording an UNVERIFIED that would never be revisited.
    if (throttled) return { verdict: "UNVERIFIED", actual: null, throttled: true };

    const found = results.find((r) => r.previewUrl === track.previewUrl);
    if (!found) continue;

    const ok =
      artistMatches(track.artistName, found.artistName) &&
      titleMatches(track.title, found.trackName);

    return {
      verdict: ok ? "MATCH" : "MISMATCH",
      actual: { title: found.trackName, artistName: found.artistName },
      // Learned once, so every future check of this track is a cheap lookup
      // rather than another throttled search.
      appleTrackId: found.trackId ? String(found.trackId) : undefined,
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
export async function verifyFeedIdentity(recheckAll = false) {
  // A full re-check clears every stored verdict first. Affordable now that
  // known tracks are settled by batched lookup rather than one search each.
  if (recheckAll) {
    await prisma.track.updateMany({
      where: {
        status: { in: CHECKED_STATUSES },
        // Hand-supplied audio is exempt. Searching Apple for it fails by
        // definition, so clearing its verdict would demote it to UNVERIFIED
        // and it could never earn the trust back.
        NOT: { audioVerdict: "VOUCHED" },
      },
      data: { audioVerdict: null },
    });
  }
  const due = await prisma.track.findMany({
    where: { audioVerdict: null, status: { in: CHECKED_STATUSES } },
    select: {
      id: true, title: true, artistName: true, previewUrl: true, artistId: true,
      appleTrackId: true,
    },
    orderBy: [{ artistId: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    // No longer a per-run cap on how much can be *looked at* — only searching
    // is rationed, below. Pulling the whole queue means every track whose
    // Apple id is known gets settled in this run for free.
    take: 5000,
  });

  // Anything whose Apple id we already know is settled in bulk first, so the
  // per-track search budget is spent only on tracks we've never seen.
  const bulk = await verifyByLookup(due);

  const mismatches: {
    id: string;
    title: string;
    artistName: string;
    actualTitle: string;
    actualArtist: string;
  }[] = [];
  let matched = 0;
  let unverified = 0;

  let searchBudget = SEARCH_BUDGET;
  let checkedNow = 0;
  let throttledOut = false;

  for (const t of due) {
    const cheap = bulk.get(t.id);
    // Anything Apple settled in bulk is free. Everything else costs a
    // throttled search, so it comes out of the budget and the leftovers stay
    // in the queue for the next run rather than being answered badly.
    if (!cheap) {
      if (searchBudget <= 0) continue;
      searchBudget -= 1;
    }
    checkedNow += 1;

    const { verdict, actual, appleTrackId, throttled } = cheap
      ? { ...cheap, appleTrackId: undefined, throttled: false }
      : await checkAudioIdentity(t);

    if (throttled) {
      // Out of rope with Apple for now. Stop rather than write guesses; the
      // next pass picks up exactly where this one stopped.
      checkedNow -= 1;
      throttledOut = true;
      break;
    }

    await prisma.track.update({
      where: { id: t.id },
      data: {
        audioVerdict: verdict,
        audioCheckedAt: new Date(),
        ...(appleTrackId ? { appleTrackId } : {}),
      },
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

  const [remaining, vouched, total, verified] = await Promise.all([
    prisma.track.count({ where: { audioVerdict: null, status: { in: CHECKED_STATUSES } } }),
    // Audio supplied by hand. Never re-checked, because searching Apple for it
    // fails for the very reason it was supplied by hand — but worth reporting,
    // since "trusted" is a weaker claim than "verified" and hiding the
    // difference would make the all-clear mean less than it appears to.
    prisma.track.count({ where: { audioVerdict: "VOUCHED", status: { in: CHECKED_STATUSES } } }),
    // So the panel can say "167 of 167" rather than leaving the size of the
    // job to be guessed from how many one run happened to get through.
    prisma.track.count({ where: { status: { in: CHECKED_STATUSES } } }),
    // A mismatch is a finished answer but not a good one, so it doesn't count
    // as verified — otherwise "167 of 167" would stay green while a track
    // played someone else's song.
    prisma.track.count({
      where: { status: { in: CHECKED_STATUSES }, audioVerdict: { in: ["MATCH", "VOUCHED"] } },
    }),
  ]);

  return {
    checkedNow,
    matched,
    unverified,
    mismatches,
    remaining,
    vouched,
    total,
    verified,
    // Distinguishes "nothing left worth asking about" from "Apple stopped
    // answering", so the caller can wait rather than give up.
    throttled: throttledOut,
  };
}

/** Every mismatch on record, so the dashboard shows old findings too. */
export async function knownMismatches() {
  return prisma.track.findMany({
    where: { audioVerdict: "MISMATCH" },
    select: { id: true, title: true, artistName: true, previewUrl: true },
    orderBy: { audioCheckedAt: "desc" },
  });
}
