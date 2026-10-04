import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

/**
 * The image an artist posts.
 *
 * Deliberately public and keyed on the track id. Everything on the card —
 * title, artist, the share link — is already public: the link is in every
 * post an artist makes. Keeping it open is what lets an email embed the card
 * as a plain <img>, which is the whole point of sending one.
 *
 * The QR is the part that earns the card. A link in an Instagram caption only
 * clicks for Meta Verified accounts, so for an ordinary feed post a scannable
 * code is the only route from the post to the song.
 */

export const runtime = "nodejs";

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  const square = req.nextUrl.searchParams.get("shape") === "post";

  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: { id: true, title: true, artistName: true, status: true },
  });
  if (!track || track.status === "REJECTED") {
    return new Response("Not found", { status: 404 });
  }

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
    ? title.length > 26 ? 56 : title.length > 16 ? 72 : 92
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
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
            <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, paddingRight: 48 }}>
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
          <>
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
          </>
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
      },
    }
  );
}
