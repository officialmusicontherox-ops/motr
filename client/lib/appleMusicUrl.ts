/**
 * Reading an Apple Music link an artist pasted.
 *
 * A song is named two ways and both are what Apple's own Share button
 * hands out:
 *
 *   https://music.apple.com/us/album/sodade/1696654909?i=1696654912
 *   https://music.apple.com/us/song/sodade/1696654912
 *
 * The first is an album link with the song in ?i=. Without the ?i= it
 * names the whole release, not a recording, and cannot be accepted.
 */
const HOST = /^https?:\/\/(?:geo\.)?(?:music|itunes)\.apple\.com\//i;

export function isAppleMusicLink(input: string): boolean {
  return HOST.test(input.trim());
}

export type AppleLink =
  | { kind: "song"; id: string; country: string | null }
  | { kind: "album" | "artist" | "playlist" | "video" | "unknown" };

export function parseAppleMusicLink(input: string): AppleLink {
  const value = input.trim();
  if (!isAppleMusicLink(value)) return { kind: "unknown" };

  // Apple ids are per storefront. A release pasted from the Canadian store
  // can be missing from the US one, so the country travels with the id.
  const country = value.match(/apple\.com\/([a-z]{2})\//i)?.[1]?.toLowerCase() ?? null;

  const id = value.match(/[?&]i=(\d+)/)?.[1] ?? value.match(/\/song\/(?:[^/?#]*\/)?(\d+)/)?.[1];
  if (id) return { kind: "song", id, country };

  if (/\/album\//i.test(value)) return { kind: "album" };
  if (/\/artist\//i.test(value)) return { kind: "artist" };
  if (/\/playlist\//i.test(value)) return { kind: "playlist" };
  if (/\/music-video\//i.test(value)) return { kind: "video" };
  return { kind: "unknown" };
}

/** Why an Apple link was not a song, in words the artist can act on. */
export function appleLinkProblem(kind: Exclude<AppleLink["kind"], "song">): string {
  switch (kind) {
    case "album":
      return "That's an album link. We need one song. In Apple Music, open the album, tap the three dots next to the song you want, then Share Song and Copy Link.";
    case "artist":
      return "That's your artist page. We need one song. In Apple Music, tap the three dots next to the song you want, then Share Song and Copy Link.";
    case "playlist":
      return "That's a playlist link. We need one song. Open the playlist, tap the three dots next to the song you want, then Share Song and Copy Link.";
    case "video":
      return "That's a music video rather than a song. In Apple Music, open the song itself, tap the three dots, then Share Song and Copy Link.";
    default:
      return "That doesn't look like an Apple Music song link. In Apple Music, tap the three dots next to the song, then Share Song and Copy Link.";
  }
}

/** Straight to the song on Apple Music. Apple fills in the rest of the path. */
export function appleSongUrl(appleTrackId: string): string {
  return `https://music.apple.com/us/song/${appleTrackId}`;
}

/**
 * The song inside an Apple Music single, from the single's album link.
 *
 * The same thing as on Spotify: a single shared from its own page is an
 * album link with no song in it. When the release has exactly one song,
 * that is the one. Anything longer returns null.
 */
export async function singleSongFromAppleAlbum(
  input: string
): Promise<{ id: string; country: string | null } | null> {
  const value = input.trim();
  const albumId = value.match(/\/album\/(?:[^/?#]*\/)?(\d+)/)?.[1];
  if (!albumId) return null;
  const country = value.match(/apple\.com\/([a-z]{2})\//i)?.[1]?.toLowerCase() ?? null;
  try {
    const data = await fetch(
      `https://itunes.apple.com/lookup?id=${albumId}&entity=song${country ? `&country=${country}` : ""}`
    ).then((r) => (r.ok ? r.json() : { results: [] }));
    const songs = ((data.results ?? []) as { wrapperType?: string; trackId?: number }[]).filter(
      (r) => r.wrapperType === "track" && r.trackId
    );
    return songs.length === 1 ? { id: String(songs[0].trackId), country } : null;
  } catch {
    return null;
  }
}
