/** Checks the parser against the shapes artists actually paste. */
import { parseSpotifyTrackId, describeSpotifyLink, resolveSpotifyShortLink } from "../lib/spotifyUrl";

const cases = [
  ["https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc", "track link"],
  ["https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT", "localised track link"],
  ["spotify:track:4cOdK2wGLETKBW3PvgPWqT", "app URI"],
  ["https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3", "album"],
  ["https://open.spotify.com/artist/6eUKZXaKkcviH0Ku9w2n3V", "artist page"],
  ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "playlist"],
  ["https://spotify.link/abc123xyz", "short link"],
];

for (const [url, label] of cases) {
  const id = parseSpotifyTrackId(url);
  console.log(`${label.padEnd(22)} parsed: ${id ? "yes" : "no "}   classified as: ${describeSpotifyLink(url)}`);
}

// A real one, to prove the short-link resolver actually works.
const real = "https://spotify.link/ZwFzCBDBaFb";
console.log(`\nresolving a real short link: ${real}`);
console.log("  ->", (await resolveSpotifyShortLink(real)) ?? "could not resolve");
