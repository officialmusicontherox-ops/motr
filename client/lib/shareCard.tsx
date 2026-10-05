import { ImageResponse } from "next/og";
import QRCode from "qrcode";

/**
 * The image an artist posts.
 *
 * Kept out of the route so it can be rendered and looked at without a server:
 * the first version shipped with the code running off the right edge of the
 * square card, which no type check was ever going to catch.
 */

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


export async function renderShareCard(params: {
  title: string;
  artistName: string;
  trackId: string;
  square: boolean;
}) {
  const { artistName, trackId, square } = params;
  const track = { id: trackId, title: params.title, artistName };

  const link = `app.musicontherox.com/?track=${track.id}`;
  const qr = await QRCode.toDataURL(`https://${link}`, {
    margin: 0,
    width: square ? 420 : 560,
    color: { dark: INK, light: "#ffffff" },
  });

  const font = await anton();
  const display = font ? "Anton" : "sans-serif";

  // Long titles have to come down in size or they run off the card.
  const title = track.title.toUpperCase();
  const titleSize = square
    ? title.length > 26 ? 44 : title.length > 16 ? 56 : 72
    : title.length > 26 ? 84 : title.length > 16 ? 108 : 136;

  const W = 1080;
  const H = square ? 1080 : 1920;
  const pad = square ? 72 : 96;

  const eyebrow = (
    <div
      style={{
        fontSize: square ? 22 : 26,
        letterSpacing: square ? 8 : 10,
        color: GOLD,
        fontWeight: 700,
        display: "flex",
      }}
    >
      MUSIC ON THE ROX
    </div>
  );

  const qrBlock = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Never squeezed and never pushed out of the card: without this the
        // title column grows to its text width and shoves the code off the
        // right edge, which is what shipped the first time.
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", background: "#ffffff", padding: square ? 22 : 30, borderRadius: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} width={square ? 420 : 560} height={square ? 420 : 560} alt="" />
      </div>
      <div
        style={{
          marginTop: square ? 18 : 26,
          fontSize: square ? 20 : 26,
          letterSpacing: 5,
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
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                // An explicit width rather than flex-grow: the title then wraps
                // inside it instead of setting the row's width itself.
                width: W - pad * 2 - 464 - 40,
                paddingRight: 40,
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
              <div style={{ marginTop: 20, fontSize: 34, color: GOLD, fontWeight: 700, display: "flex" }}>
                {track.artistName}
              </div>
              <div style={{ marginTop: 28, fontSize: 30, lineHeight: 1.4, color: BODY, display: "flex" }}>
                No name. No artwork. Just 30 seconds of the song.
              </div>
            </div>
            {qrBlock}
          </div>
        ) : (
          // A real element, not a fragment: the image renderer does not treat a
          // fragment as a flex child, so these three blocks collapsed on top of
          // each other and the code vanished off the card entirely.
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              justifyContent: "space-between",
              paddingTop: 40,
              paddingBottom: 40,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
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
              <div style={{ marginTop: 26, fontSize: 44, color: GOLD, fontWeight: 700, display: "flex" }}>
                {track.artistName}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 40, color: BODY, display: "flex" }}>
                They won&rsquo;t see my name or my artwork.
              </div>
              <div style={{ marginTop: 10, fontSize: 40, color: "#ffffff", fontWeight: 700, display: "flex" }}>
                Just 30 seconds of the song.
              </div>
            </div>

            {qrBlock}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", borderTop: `2px solid ${EDGE}`, paddingTop: 28 }}>
          <div style={{ fontSize: square ? 26 : 34, color: BODY, display: "flex" }}>
            Swipe right if it lands.
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: square ? 26 : 34,
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
        // Cached hard: the card only changes if the track is renamed.
        "cache-control": "public, max-age=3600, s-maxage=86400",
        // Netlify keys its cache on the path and a fixed list of query
        // parameters, so without this both shapes share one entry and
        // whichever was asked for first is served for ever after. The square
        // card came back 1080x1920 in production because of exactly that.
        "netlify-vary": "query=shape",
      },
    }
  );
}
