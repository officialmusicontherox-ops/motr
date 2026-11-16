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
 * Where a listener is sent to hear the whole song, and which service that is.
 *
 * A song the artist submitted from Apple Music goes to Apple Music, at the
 * exact song. Everything else goes to Spotify as before.
 */
export function listenLinkFor(track: {
  externalId: string;
  source: string;
  title: string;
  artistName: string;
  appleTrackId?: string | null;
}): { listenUrl: string; listenOn: "spotify" | "apple" } {
  if (track.source === "APPLE_MUSIC" && track.appleTrackId) {
    return { listenUrl: `https://music.apple.com/us/song/${track.appleTrackId}`, listenOn: "apple" };
  }
  return { listenUrl: spotifyLinkFor(track), listenOn: "spotify" };
}
