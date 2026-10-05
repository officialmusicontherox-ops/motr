import { ImageResponse } from "next/og";
import QRCode from "qrcode";

/**
 * The image an artist posts.
 *
 * Built around their own cover art. The app is blind on purpose, but the
 * graphic an artist puts on their story is their promotion, not the test, so
 * the artwork belongs on it: without it the card is a code on a black field,
 * which reads as a QR code rather than as a release.
 *
 * Kept out of the route so it can be rendered and looked at without a server:
 * an earlier version shipped with the code running off the right edge, which
 * no type check was ever going to catch.
 */

/**
 * Bumped whenever the card's design changes.
 *
 * The image is cached hard at the edge for a day, so without this a design
 * change leaves old cards being served to anyone whose copy was already
 * stored: an email went out showing a card that claimed "no artwork" over a
 * card that had artwork on it. The version travels in the URL and is part of
 * the cache key, so bumping it retires every stored copy at once.
 */
export const CARD_VERSION = "2";

const INK = "#09090a";
const GOLD = "#dcb55f";
const EDGE = "#262625";
const BODY = "#c9c9c9";
const MUTED = "#8b8b8b";

/** Anton is the app's display face; the card falls back rather than fails. */
let antonCache: ArrayBuffer | null | undefined;
async function anton(): Promise<ArrayBuffer | null> {
  if (antonCache !== undefined) return antonCache;
  try {
    // An old user-agent makes Google serve TrueType rather than woff2, which
    // is the only one the image renderer can read.
    const css = await fetch("https://fonts.googleapis.com/css2?family=Anton", {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 6.1; WOW64)" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    antonCache = url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    antonCache = null;
  }
  return antonCache ?? null;
}

/**
 * The cover as a data URI.
 *
 * Inlined rather than left as a URL: the renderer fetching it itself fails
 * quietly and leaves a hole in the middle of the card, and a card that draws
 * without the artwork is better than one that half-draws.
 */
async function cover(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\//i.test(type)) return null;
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function renderShareCard(params: {
  title: string;
  artistName: string;
  trackId: string;
  artworkUrl?: string | null;
  square: boolean;
}) {
  const { artistName, trackId, square } = params;

  const link = `app.musicontherox.com/?track=${trackId}`;
  const [qr, art, font] = await Promise.all([
    QRCode.toDataURL(`https://${link}`, {
      margin: 0,
      width: square ? 300 : 360,
      color: { dark: INK, light: "#ffffff" },
    }),
    cover(params.artworkUrl),
    anton(),
  ]);

  const display = font ? "Anton" : "sans-serif";
  const title = params.title.toUpperCase();

  const W = 1080;
  const H = square ? 1080 : 1920;
  const pad = square ? 64 : 88;
  const artSize = square ? 380 : 700;
  const qrSize = square ? 300 : 360;

  // Long titles come down a step rather than running off the card.
  const titleSize = square
    ? title.length > 26
      ? 40
      : title.length > 16
        ? 50
        : 62
    : title.length > 26
      ? 68
      : title.length > 16
        ? 84
        : 100;

  const eyebrow = (
    <div
      style={{
        fontSize: square ? 20 : 24,
        letterSpacing: square ? 7 : 9,
        color: GOLD,
        fontWeight: 700,
        display: "flex",
      }}
    >
      MUSIC ON THE ROX
    </div>
  );

  const artwork = art ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={art}
      width={artSize}
      height={artSize}
      alt=""
      style={{ borderRadius: 20, objectFit: "cover" }}
    />
  ) : null;

  const code = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
      <div style={{ display: "flex", background: "#ffffff", padding: 18, borderRadius: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} width={qrSize} height={qrSize} alt="" />
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: square ? 17 : 22,
          letterSpacing: 4,
          color: MUTED,
          fontWeight: 700,
          display: "flex",
        }}
      >
        SCAN TO HEAR IT
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          background: INK,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: pad,
          fontFamily: "sans-serif",
        }}
      >
        {eyebrow}

        {square ? (
          <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
            {artwork}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: W - pad * 2 - artSize - 36,
              }}
            >
              <div
                style={{
                  fontFamily: display,
                  fontSize: titleSize,
                  lineHeight: 1,
                  color: "#ffffff",
                  display: "flex",
                }}
              >
                {title}
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 30,
                  color: GOLD,
                  fontWeight: 700,
                  display: "flex",
                }}
              >
                {artistName}
              </div>
              <div style={{ marginTop: 22, display: "flex" }}>{code}</div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
              gap: 34,
            }}
          >
            {artwork}

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  fontFamily: display,
                  fontSize: titleSize,
                  lineHeight: 1,
                  color: "#ffffff",
                  display: "flex",
                  textAlign: "center",
                }}
              >
                {title}
              </div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 38,
                  color: GOLD,
                  fontWeight: 700,
                  display: "flex",
                }}
              >
                {artistName}
              </div>
            </div>

            {code}
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderTop: `2px solid ${EDGE}`,
            paddingTop: 22,
          }}
        >
          <div style={{ fontSize: square ? 22 : 30, color: BODY, display: "flex" }}>
            Give it 30 seconds. Swipe right if you like it.
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: square ? 22 : 30,
              color: GOLD,
              fontWeight: 700,
              display: "flex",
            }}
          >
            app.musicontherox.com
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: font ? [{ name: "Anton", data: font, style: "normal", weight: 400 }] : [],
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=86400",
        // Netlify keys its cache on the path and a fixed list of query
        // parameters, so without this both shapes share one entry and
        // whichever was asked for first is served for ever after.
        "netlify-vary": "query=shape|v",
      },
    }
  );
}
