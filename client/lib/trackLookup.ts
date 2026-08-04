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
 * WARNING about the Deezer fallback: its preview URLs are signed and expire
 * after a while. Storing one means the track plays for a day and then goes
 * silent — 58 of them died overnight once, taking 42% of the feed with them
 * and looking for all the world like a player bug. Anything saved from
 * Deezer must be re-resolved against iTunes before it is written, or
 * re-checked on a schedule. Prefer iTunes for anything persisted.
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

/** Where an artist should write when an automatic lookup can't be trusted. */
const CONTACT_EMAIL = process.env.EMAIL_REPLY_TO ?? "officialmusicontherox@gmail.com";

type Oembed = { title: string; thumbnail_url?: string };

/**
 * The artist behind a Spotify track.
 *
 * oEmbed returns a title and nothing else — no artist — which is why the
 * preview lookup used to search on title alone and could attach a different
 * artist's recording to someone's submission. The track page carries the
 * real credits in its meta tags.
 */
export async function fetchSpotifyArtist(trackId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://open.spotify.com/track/${trackId}`, {
      headers: {
        // Counter-intuitive but load-bearing: Spotify serves the rendered
        // page with its meta tags to crawlers, and an empty JavaScript shell
        // to anything that looks like a browser. Identify honestly as a bot.
        "user-agent": "MOTR/1.0 (+https://app.musicontherox.com)",
        accept: "*/*",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const musician = html.match(
      /<meta name="music:musician_description" content="([^"]+)"/
    )?.[1];
    if (musician) return decodeEntities(musician);

    // "Artist · Title · Song · 2024"
    const desc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1];
    const first = desc?.split("·")[0]?.trim();
    return first ? decodeEntities(first) : null;
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Loose comparison: accents, case, punctuation and "feat." all vary by source. */
function normaliseName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(feat|ft|featuring|with|and)\b/g, "&")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}

/**
 * Does this candidate credit the artist we're looking for?
 *
 * Only the lead artist has to match. Sources disagree constantly about
 * collaborators — Spotify's "Luis Martelo, Badoxa" is Apple's "Luis Martelo
 * & Badoxa" or just "Luis Martelo" — but they agree on who leads.
 */
export function artistMatches(expected: string, candidate: string): boolean {
  const lead = normaliseName(expected.split(/[,&]/)[0]);
  const candidateLead = normaliseName(candidate.split(/[,&]/)[0]);
  if (!lead || !candidateLead) return false;

  // Leads agree, or the candidate credits our lead among its artists.
  // Deliberately not the reverse: "Tribe" must not match "A Tribe Called
  // Quest", or a short name would sweep up unrelated acts.
  return lead === candidateLead || normaliseName(candidate).includes(lead);
}

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

/**
 * Turns a pasted Spotify link into something playable.
 *
 * The rule that matters: **we never attach audio we can't confirm belongs to
 * the artist who submitted it.** An earlier version searched on title alone
 * and stored whichever artist iTunes returned, so a track called "Sodade"
 * came back as Cesária Evora's recording under the submitter's own artwork.
 * An artist seeing their picture over someone else's song is the worst thing
 * this app can do, so a lookup that can't be verified is refused outright.
 */
export async function resolveSpotifyTrack(trackId: string): Promise<ResolvedTrack> {
  const [oembed, spotifyArtist] = await Promise.all([
    fetchSpotifyOembed(trackId),
    fetchSpotifyArtist(trackId),
  ]);

  const displayTitle = oembed.title?.trim();
  if (!displayTitle) {
    throw new TrackLookupError("That Spotify link didn't return a track title.");
  }
  if (!spotifyArtist) {
    throw new TrackLookupError(
      `We couldn't read the artist from that Spotify link. Check it's a public track link — and ` +
        `if it is, email it to ${CONTACT_EMAIL} and we'll add it by hand.`
    );
  }

  const title = searchableTitle(displayTitle);
  // Artist *and* title. Title alone is what caused the mismatches.
  const term = `${spotifyArtist.split(/[,&]/)[0].trim()} ${title}`;

  const itunes = await searchItunes(term);
  if (itunes?.previewUrl && artistMatches(spotifyArtist, itunes.artistName)) {
    return {
      title: displayTitle,
      // Spotify's credits, not the catalogue's — this is the artist's own link.
      artistName: spotifyArtist,
      albumName: itunes.collectionName ?? null,
      artworkUrl: oembed.thumbnail_url ?? upscaleArtwork(itunes.artworkUrl100),
      previewUrl: itunes.previewUrl,
      durationMs: itunes.trackTimeMillis ?? null,
    };
  }

  const deezer = await searchDeezer(term);
  if (deezer?.preview && artistMatches(spotifyArtist, deezer.artist.name)) {
    return {
      title: displayTitle,
      artistName: spotifyArtist,
      albumName: deezer.album?.title ?? null,
      artworkUrl:
        oembed.thumbnail_url ?? deezer.album?.cover_big ?? deezer.album?.cover_medium ?? null,
      previewUrl: deezer.preview,
      durationMs: deezer.duration ? deezer.duration * 1000 : null,
    };
  }

  // Something was found, but by someone else. Refusing is the right answer:
  // serving it would put another artist's recording under this one's name.
  throw new TrackLookupError(
    `We found "${displayTitle}" but couldn't confirm a preview that is actually ${spotifyArtist}'s ` +
      `recording — so we haven't added it, because we won't put another artist's audio under your ` +
      `name. This usually means the release isn't on Apple Music or Deezer yet. ` +
      `If the Spotify link is right, email it to ${CONTACT_EMAIL} and we'll add it by hand.`
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
