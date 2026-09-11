import type { MetadataRoute } from "next";

/**
 * Makes MOTR installable. There's no native app and no app store — this is
 * what lets someone add MOTR to a phone home screen or a desktop dock and
 * have it open in its own window with no browser chrome.
 *
 * Requires HTTPS, so installation only becomes available once deployed
 * (localhost is exempt for testing).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MOTR — Music On The Rox",
    short_name: "MOTR",
    description:
      "Discover music before anyone tells you who made it. Thirty-second clips with no names and no artwork. Swipe what moves you and keep what you love.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#09090a",
    theme_color: "#09090a",
    categories: ["music", "entertainment"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Padded so Android's circular/squircle crop can't clip the wordmark.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Discover", url: "/", description: "Swipe the feed" },
      { name: "Saved", url: "/saved", description: "Music you kept" },
      { name: "Submit a song", url: "/artists", description: "Artists: get in the feed" },
    ],
  };
}
