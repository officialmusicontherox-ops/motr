/**
 * Resolving a pasted Spotify link into something playable.
 *
 * Spotify's catalog API can't be used for this: it returns 403 without an
 * active-Premium app owner, and since Nov 2024 it no longer returns
 * `preview_url` to new applications at all. So we assemble the track from two
 * public sources that need no keys:
 *
 *   - Spotify oEmbed  -> title + album art (authoritative for the link given)
 *   - iTunes Search   -> the 30s preview audio, artist, album
 *   - Deezer Search   -> fallback preview when Apple doesn't carry the track
 *
 * The two preview sources matter: not everything on Spotify is on Apple
 * Music, and iTunes also rate-limits to 403 under load. Either would reject a
 * legitimate submission outright, so we try both before giving up.
 *
 * The Spotify id is still stored, because that's what a fan's
 * save-to-playlist needs later.
 */

export type ResolvedTrack = {
  title: string;
  artistName: string;
  albumName: string | null;
  artworkUrl: string | null;
  previewUrl: string;
  durationMs: number | null;
};

export class TrackLookupError extends Error {}

type Oembed = { title: string; thumbnail_url?: string };

export async function fetchSpotifyOembed(trackId: string): Promise<Oembed> {
  const res = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(
      `https://open.spotify.com/track/${trackId}`
    )}`,
    { headers: { accept: "application/json" } }
  );
  if (!res.ok) {
    throw new TrackLookupError("Couldn't read that Spotify link. Is the track public?");
  }
  return res.json();
}

/**
 * oEmbed titles carry featured-artist tails like
 * "Get Lucky (feat. Pharrell Williams and Nile Rodgers)". Good for display,
 * noisy for search — this trims it for matching.
 */
export function searchableTitle(title: string): string {
  return title
    .replace(/\s*[([]\s*(feat|ft|with)\.?[^)\]]*[)\]]/gi, "")
    .replace(/\s*-\s*(remaster(ed)?|radio edit|single version).*$/i, "")
    .trim();
}

type ItunesResult = {
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
};

export async function searchItunes(term: string): Promise<ItunesResult | null> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term
  )}&media=music&entity=song&limit=5`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as { results?: ItunesResult[] };
  // Only a result with audio is useful to us.
  return data.results?.find((r) => r.previewUrl) ?? null;
}

type DeezerResult = {
  title: string;
  artist: { name: string };
  album?: { title?: string; cover_big?: string; cover_medium?: string };
  preview?: string;
  duration?: number;
};

/**
 * Deezer's search needs no key and carries plenty that Apple doesn't,
 * including a lot of independent and non-US releases.
 */
export async function searchDeezer(term: string): Promise<DeezerResult | null> {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=5`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: DeezerResult[] };
    return data.data?.find((r) => r.preview) ?? null;
  } catch {
    return null;
  }
}

/** iTunes serves 100x100 by default; the same asset exists at larger sizes. */
function upscaleArtwork(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/600x600bb.$1");
}

export async function resolveSpotifyTrack(trackId: string): Promise<ResolvedTrack> {
  const oembed = await fetchSpotifyOembed(trackId);
  const displayTitle = oembed.title?.trim();
  if (!displayTitle) {
    throw new TrackLookupError("That Spotify link didn't return a track title.");
  }

  const term = searchableTitle(displayTitle);

  const itunes = await searchItunes(term);
  if (itunes?.previewUrl) {
    return {
      title: displayTitle,
      artistName: itunes.artistName,
      albumName: itunes.collectionName ?? null,
      // Prefer Spotify's art — it matches the exact release that was linked.
      artworkUrl: oembed.thumbnail_url ?? upscaleArtwork(itunes.artworkUrl100),
      previewUrl: itunes.previewUrl,
      durationMs: itunes.trackTimeMillis ?? null,
    };
  }

  const deezer = await searchDeezer(term);
  if (deezer?.preview) {
    return {
      title: displayTitle,
      artistName: deezer.artist.name,
      albumName: deezer.album?.title ?? null,
      artworkUrl:
        oembed.thumbnail_url ?? deezer.album?.cover_big ?? deezer.album?.cover_medium ?? null,
      previewUrl: deezer.preview,
      durationMs: deezer.duration ? deezer.duration * 1000 : null,
    };
  }

  throw new TrackLookupError(
    `We couldn't find a playable 30-second preview for "${displayTitle}". That usually means the ` +
      `release is too new or isn't on Apple Music or Deezer yet. Email us and we'll add it by hand.`
  );
}

/** Used by the backfill, where all we have is what's already in the row. */
export async function resolveBySearch(
  title: string,
  artistName: string
): Promise<ResolvedTrack | null> {
  const itunes = await searchItunes(`${artistName} ${title}`);
  if (!itunes?.previewUrl) return null;

  return {
    title: itunes.trackName,
    artistName: itunes.artistName,
    albumName: itunes.collectionName ?? null,
    artworkUrl: upscaleArtwork(itunes.artworkUrl100),
    previewUrl: itunes.previewUrl,
    durationMs: itunes.trackTimeMillis ?? null,
  };
}
