import type { MetadataRoute } from "next";

/**
 * The app runs on two hostnames — app.musicontherox.com and the
 * motr-client.vercel.app address Vercel assigns. Both serve identical pages,
 * which search engines read as duplicate content and which splits whatever
 * ranking either one earns.
 *
 * So: only the real domain is crawlable. The Vercel address is blocked
 * outright, and every page also carries a canonical URL pointing home.
 */
export default function robots(): MetadataRoute.Robots {
  const host = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_URL : undefined;
  const isPreviewHost = host?.endsWith(".vercel.app");

  if (isPreviewHost) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here is useful in a search result: the dashboard needs a
      // login, the curator pages are personal, and API routes aren't pages.
      disallow: ["/admin", "/curate", "/curator/", "/submit/", "/api/", "/saved"],
    },
    sitemap: "https://app.musicontherox.com/sitemap.xml",
  };
}
