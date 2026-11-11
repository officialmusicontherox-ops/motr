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

  // All of their live tracks, not just the newest. Apple ids are filled in
  // at submission and a release that predates that has none, so reading only
  // the latest track left ten artists with no Apple link while their own
  // back catalogue carried the id.
  const tracks = await prisma.track.findMany({
    where: { artistId, status: { not: "REJECTED" } },
    select: {
      externalId: true,
      source: true,
      title: true,
      artistName: true,
      appleTrackId: true,
      appleArtistId: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const track = tracks.find((t) => t.source === "SPOTIFY");
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

  out.appleArtistUrl = await appleLink(tracks);

  return out;
}


type AppleSource = {
  title: string;
  artistName: string;
  appleTrackId: string | null;
  appleArtistId: string | null;
};

/**
 * The artist's own page on Apple Music, by the cheapest route that works.
 *
 * Three ways in, in order of how certain each one is:
 *  1. An Apple artist id already stored on one of their tracks. That is the
 *     same id the charts group on, so it costs nothing and cannot be wrong.
 *  2. An Apple track id, which a lookup turns into the artist's page.
 *  3. A search, for the older releases that predate both. Only accepted on
 *     an exact name match against Apple's own spelling, because a near match
 *     sends listeners to a different artist, which is worse than no link.
 *
 * Never throws. A missing link hides one mark on a tile, nothing more.
 */
async function appleLink(tracks: AppleSource[]): Promise<string | null> {
  const byArtistId = tracks.find((t) => t.appleArtistId)?.appleArtistId;
  if (byArtistId) return `https://music.apple.com/us/artist/${byArtistId}`;

  const byTrackId = tracks.find((t) => t.appleTrackId)?.appleTrackId;
  if (byTrackId) {
    try {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${byTrackId}&entity=song`);
      if (res.ok) {
        const body = (await res.json()) as {
          results?: { wrapperType?: string; artistViewUrl?: string }[];
        };
        const hit = (body.results ?? []).find((r) => r.wrapperType === "track");
        if (hit?.artistViewUrl) return hit.artistViewUrl;
      }
    } catch {
      // Fall through to the search.
    }
  }

  const seed = tracks[0];
  if (!seed) return null;
  try {
    const term = encodeURIComponent(`${seed.artistName} ${seed.title}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=10`);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      results?: { artistName?: string; artistViewUrl?: string }[];
    };
    const want = seed.artistName.trim().toLowerCase();
    const hit = (body.results ?? []).find(
      (r) => r.artistViewUrl && r.artistName?.trim().toLowerCase() === want
    );
    return hit?.artistViewUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch and store. Returns what was written.
 *
 * A field that came back empty is left alone rather than written as null.
 * These are read from pages we do not control, and one flaky response would
 * otherwise wipe a good photo or listener count off a tile and leave it
 * blank until the next refresh happened to go better.
 */
export async function refreshProfile(artistId: string) {
  const p = await fetchProfile(artistId);
  const data: Record<string, unknown> = { profileFetchedAt: new Date() };
  for (const [k, v] of Object.entries(p)) if (v !== null) data[k] = v;
  await prisma.artist.update({ where: { id: artistId }, data });
  return p;
}
