/**
 * Getting a fan's saved track into their Spotify, without Spotify's API.
 *
 * The API route is closed to us: extended quota mode requires an
 * organization with 250k+ monthly actives, and development mode allows five
 * users total. So the "+" button could only ever have worked for a handful
 * of people.
 *
 * A plain link needs none of that. On a phone it opens the Spotify app
 * directly at the track, where saving is one tap — the same end result, for
 * everyone, with no sign-in and no quota.
 */

/** Spotify ids are 22 characters of base62. */
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

export function spotifyLinkFor(track: {
  externalId: string;
  source: string;
  title: string;
  artistName: string;
}): string {
  // A track submitted as a Spotify link carries the real id, so we can go
  // straight to it rather than making the fan pick out of search results.
  if (track.source === "SPOTIFY" && SPOTIFY_ID.test(track.externalId)) {
    return `https://open.spotify.com/track/${track.externalId}`;
  }

  // Everything else — the seeded catalogue is keyed by iTunes/Deezer ids —
  // falls back to a search, which still lands in the app on mobile.
  const q = encodeURIComponent(`${track.artistName} ${track.title}`);
  return `https://open.spotify.com/search/${q}`;
}

/**
 * Where a listener can hear the whole song, on both services.
 *
 * Both, on every song, so each listener taps the one they use. One button
 * chosen by how the artist submitted sent Spotify listeners to Apple Music
 * and the reverse.
 *
 * Apple: the exact recording, which nearly every song carries, including
 * those submitted from Spotify. Spotify: the exact track where the artist
 * submitted from Spotify; otherwise a search for it, because Spotify will
 * not answer MOTR's lookups to find the match.
 */
export function listenLinksFor(track: {
  externalId: string;
  source: string;
  title: string;
  artistName: string;
  appleTrackId?: string | null;
}): { spotifyUrl: string; appleUrl: string | null } {
  return {
    spotifyUrl: spotifyLinkFor(track),
    appleUrl: track.appleTrackId ? `https://music.apple.com/us/song/${track.appleTrackId}` : null,
  };
}
