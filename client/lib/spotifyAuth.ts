import type { NextRequest } from "next/server";

/**
 * Spotify stopped accepting `localhost` in redirect URIs (April 2025) but
 * still allows the loopback IP literal. Those are the same machine, yet the
 * browser treats them as different origins — so a cookie set on one is not
 * sent to the other. The whole OAuth flow therefore has to run on the host
 * Spotify will accept.
 *
 * Note: `req.nextUrl.origin` reports the dev server's own bound address, not
 * the host the browser used, so host checks must read the Host header.
 */
export function requestHost(req: NextRequest): string {
  return req.headers.get("host") ?? req.nextUrl.host;
}

export function isLocalhostHost(host: string): boolean {
  return host.startsWith("localhost");
}

function originFromHost(req: NextRequest, host: string): string {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** Browser-facing origin, with localhost swapped for the loopback IP. */
export function canonicalOrigin(req: NextRequest): string {
  const host = requestHost(req);
  const fixed = isLocalhostHost(host) ? host.replace("localhost", "127.0.0.1") : host;
  return originFromHost(req, fixed);
}

/**
 * The exact value registered in the Spotify dashboard. Set
 * SPOTIFY_REDIRECT_URI in production; locally it's derived.
 */
export function spotifyRedirectUri(req: NextRequest): string {
  return (
    process.env.SPOTIFY_REDIRECT_URI ?? `${canonicalOrigin(req)}/api/auth/spotify/callback`
  );
}
