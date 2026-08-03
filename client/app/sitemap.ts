import type { MetadataRoute } from "next";

const SITE = "https://app.musicontherox.com";

/**
 * Only the pages that make sense as a search result. The feed itself is
 * personal to each visitor and the curator and admin screens are gated, so
 * none of those belong here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/artists`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE}/apply`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
