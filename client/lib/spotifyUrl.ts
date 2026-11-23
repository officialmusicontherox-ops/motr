/**
 * Pulls a track id out of whatever an artist pastes — a share link, an
 * app URI, or the bare id.
 *
 *   https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc
 *   spotify:track:4cOdK2wGLETKBW3PvgPWqT
 *   4cOdK2wGLETKBW3PvgPWqT
 */
export function parseSpotifyTrackId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const uri = value.match(/^spotify:track:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];

  const url = value.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/);
  if (url) return url[1];

  if (/^[A-Za-z0-9]{22}$/.test(value)) return value;

  return null;
}

/** What an artist pasted, when it wasn't a track link. */
export type LinkProblem = "album" | "artist" | "playlist" | "episode" | "short" | "unknown";

/**
 * Why a link didn't parse, so the artist can be told something useful.
 *
 * "That doesn't look like a Spotify track link" is true and useless. An
 * artist who pasted their album needs to hear that it's an album, not that
 * their link is wrong — they can see it isn't.
 */
export function describeSpotifyLink(input: string): LinkProblem {
  const value = input.trim().toLowerCase();
  if (/spotify\.link\/|spotify\.app\.link\//.test(value)) return "short";
  if (/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\//.test(value)) return "album";
  if (/open\.spotify\.com\/(?:intl-[a-z-]+\/)?artist\//.test(value)) return "artist";
  if (/open\.spotify\.com\/(?:intl-[a-z-]+\/)?playlist\//.test(value)) return "playlist";
  if (/open\.spotify\.com\/(?:intl-[a-z-]+\/)?episode\//.test(value)) return "episode";
  return "unknown";
}

/**
 * Follows a spotify.link short URL to the real one.
 *
 * Sharing from the Spotify iPhone app frequently produces spotify.link
 * rather than open.spotify.com, and that form carries no track id at all —
 * it has to be resolved over the network. Artists were pasting these,
 * getting "that doesn't look like a track link", and having no way to know
 * what was wrong with a link Spotify itself had just generated for them.
 */
export async function resolveSpotifyShortLink(input: string): Promise<string | null> {
  const value = input.trim();
  if (!/^https?:\/\/(spotify\.link|spotify\.app\.link)\//i.test(value)) return null;

  try {
    // A HEAD is enough: the id is in the redirect target, and these pages are
    // heavy. Some of them answer only to a browser-shaped request.
    const res = await fetch(value, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      },
    });

    const fromUrl = parseSpotifyTrackId(res.url ?? "");
    if (fromUrl) return fromUrl;

    // Some short links land on an interstitial that carries the real URL in
    // the markup rather than in a redirect.
    const html = await res.text();
    const match = html.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * The song inside a Spotify single, from the single's own link.
 *
 * On Spotify a single is a one-song album, so sharing from the single's
 * page gives an /album/ link, and artists were being told to go back and
 * copy the song instead. The album's public page lists its songs, so when
 * there is exactly one, that is the song they meant. A real album or EP
 * returns null and still asks for the specific song.
 */
export async function singleTrackFromAlbum(input: string): Promise<string | null> {
  const albumId = input.trim().match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\/([A-Za-z0-9]{22})/)?.[1];
  if (!albumId) return null;
  try {
    const html = await fetch(`https://open.spotify.com/album/${albumId}`, {
      // The page carries its meta tags for crawlers, not for browsers.
      headers: { "user-agent": "MOTR/1.0 (+https://app.musicontherox.com)", accept: "*/*" },
    }).then((r) => (r.ok ? r.text() : ""));
    const songs = [
      ...new Set(
        [...html.matchAll(/name="music:song" content="https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]{22})"/g)].map((m) => m[1])
      ),
    ];
    return songs.length === 1 ? songs[0] : null;
  } catch {
    return null;
  }
}
