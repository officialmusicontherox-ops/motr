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

  const itunes = await searchItunes(searchableTitle(displayTitle));
  if (!itunes?.previewUrl) {
    throw new TrackLookupError(
      `We couldn't find a playable 30-second preview for "${displayTitle}". It may not be on Apple Music yet.`
    );
  }

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
