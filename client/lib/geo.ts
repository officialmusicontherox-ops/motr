import type { NextRequest } from "next/server";

/**
 * Where a request came from, according to the edge network.
 *
 * No IP address is stored and no third-party lookup is made. The host works
 * this out before the request reaches us and passes it in a header; we either
 * get it or we don't, and "don't" is a perfectly ordinary answer.
 *
 * Worth capturing from the first day it occurs to anyone, because geography
 * is the one signal that cannot be reconstructed later — a swipe whose origin
 * went unrecorded is unrecoverable, however much anyone wants it in six
 * months' time.
 */
export type SwipeGeo = {
  countryCode: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
};

const EMPTY: SwipeGeo = { countryCode: null, countryName: null, region: null, city: null };

/** Rejects the placeholder values edge networks use when they don't know. */
function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed.toUpperCase() === "XX") return null;
  // Long enough to be a header injection or a bug rather than a place name.
  return trimmed.slice(0, 120);
}

export function readGeo(req: NextRequest): SwipeGeo {
  // Netlify's own geolocation, base64 JSON. Shape:
  //   { city, country: { code, name }, subdivision: { code, name }, timezone }
  const packed = req.headers.get("x-nf-geo");
  if (packed) {
    try {
      const decoded = JSON.parse(
        typeof atob === "function"
          ? atob(packed)
          : Buffer.from(packed, "base64").toString("utf8")
      );
      const geo: SwipeGeo = {
        countryCode: clean(decoded?.country?.code),
        countryName: clean(decoded?.country?.name),
        region: clean(decoded?.subdivision?.name) ?? clean(decoded?.subdivision?.code),
        city: clean(decoded?.city),
      };
      if (geo.countryCode || geo.city) return geo;
    } catch {
      // Malformed header is the same as no header.
    }
  }

  // Plain-header fallbacks, so this keeps working if the host changes or the
  // app is run somewhere else entirely. Country only — that is all they give.
  const code =
    clean(req.headers.get("x-country")) ??
    clean(req.headers.get("cf-ipcountry")) ??
    clean(req.headers.get("x-vercel-ip-country"));

  const region =
    clean(req.headers.get("x-nf-subdivision-code")) ??
    clean(req.headers.get("x-vercel-ip-country-region"));

  const city = clean(req.headers.get("x-vercel-ip-city"));

  if (!code && !region && !city) return EMPTY;
  return { countryCode: code, countryName: null, region, city };
}
