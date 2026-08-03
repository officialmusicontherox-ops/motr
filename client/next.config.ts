import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The admin dashboard is the thing worth protecting: without frame
 * protection someone can load it invisibly inside their own page and trick a
 * signed-in admin into clicking buttons they can't see.
 *
 * Kept as headers rather than middleware so they apply to static assets and
 * error pages too, which middleware would miss.
 */
const securityHeaders = [
  // No embedding anywhere — nothing here is meant to be iframed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },

  // Don't let a browser second-guess a response's declared type.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Don't leak the admin path (or any full URL) to third parties in Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Nothing in MOTR needs these.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },

  // Refuse plain HTTP for a year. Vercel already redirects, but this stops
  // the first insecure request from ever leaving the browser.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
