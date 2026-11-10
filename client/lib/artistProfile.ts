import { prisma } from "./prisma";

/**
 * An artist's public profile, for the Spotlight tab.
 *
 * Read from the pages Spotify and Apple already serve rather than from their
 * APIs: the Spotify catalogue API answers 403 without an active Premium
 * account on the app owner's side, and the public track page carries what is
 * needed anyway. The same method already matches artist names on submission.
 *
 * Cached on the Artist row because it costs two page reads, which is far too
 * slow to do while rendering a tab and would be rate-limited besides.
 */

const UA = {
  // Spotify serves the rendered page with its meta tags to crawlers and an
  // empty JavaScript shell to anything that looks like a browser.
  "user-agent": "MOTR/1.0 (+https://app.musicontherox.com)",
  accept: "*/*",
};

/** "2.6K monthly listeners" and "1,284 monthly listeners" both. */
function listeners(description: string): number | null {
  const m = description.match(/([\d.,]+)\s*([KM]?)\s*monthly listeners/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * (m[2] === "M" ? 1e6 : m[2] === "K" ? 1e3 : 1));
}

export type FetchedProfile = {
  spotifyArtistId: string | null;
  photoUrl: string | null;
  monthlyListeners: number | null;
  appleArtistUrl: string | null;
};

/**
 * Follow one of the artist's tracks out to their profiles.
 *
 * Never throws. A tile renders without a photo or a listener count; it must
 * not fail to render because a third-party page changed shape.
 */
export async function fetchProfile(artistId: string): Promise<FetchedProfile> {
  const empty: FetchedProfile = {
    spotifyArtistId: null,
    photoUrl: null,
    monthlyListeners: null,
    appleArtistUrl: null,
  };

  const track = await prisma.track.findFirst({
    where: { artistId, status: { not: "REJECTED" }, source: "SPOTIFY" },
    select: { externalId: true, appleTrackId: true },
    orderBy: { createdAt: "desc" },
  });
  if (!track) return empty;

  const out = { ...empty };

  try {
    const page = await fetch(`https://open.spotify.com/track/${track.externalId}`, { headers: UA })
      .then((r) => (r.ok ? r.text() : ""));
    const sid = page.match(/open\.spotify\.com\/artist\/([A-Za-z0-9]+)/)?.[1] ?? null;
    out.spotifyArtistId = sid;

    if (sid) {
      const artistPage = await fetch(`https://open.spotify.com/artist/${sid}`, { headers: UA })
        .then((r) => (r.ok ? r.text() : ""));
      out.photoUrl = artistPage.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? null;
      const desc = artistPage.match(/<meta property="og:description" content="([^"]+)"/)?.[1] ?? "";
      out.monthlyListeners = listeners(desc);
    }
  } catch {
    // Leave what was read so far; a partial profile still renders.
  }

  // Apple's link comes from the id already stored at submission, so it costs
  // a lookup rather than a search and is not rate-limited the same way.
  if (track.appleTrackId) {
    try {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${track.appleTrackId}&entity=song`);
      if (res.ok) {
        const body = (await res.json()) as { results?: { wrapperType?: string; artistViewUrl?: string }[] };
        const hit = (body.results ?? []).find((r) => r.wrapperType === "track");
        out.appleArtistUrl = hit?.artistViewUrl ?? null;
      }
    } catch {
      // Same again: a missing Apple link hides one button, nothing more.
    }
  }

  return out;
}

/** Fetch and store. Returns what was written. */
export async function refreshProfile(artistId: string) {
  const p = await fetchProfile(artistId);
  await prisma.artist.update({
    where: { id: artistId },
    data: { ...p, profileFetchedAt: new Date() },
  });
  return p;
}
