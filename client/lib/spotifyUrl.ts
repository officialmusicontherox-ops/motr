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
