import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { anton } from "./shareCard";
import { APP_URL } from "./appUrl";
import type { Badge } from "./achievements";

/**
 * The graphic a listener posts when they earn something.
 *
 * One badge per image, 1080x1920, because that is what a story is. An earlier
 * version put every badge on one square and read like a receipt: nobody posts
 * a summary of themselves, they post the one thing that just happened.
 *
 * Only the words change between badges. The frame, the glow and the code are
 * fixed, so a feed of these reads as a set rather than as a dozen unrelated
 * pictures.
 *
 * Nothing on it identifies the person. A posted image travels further than
 * anyone intends, so there is no name and no address, only what was earned.
 */

export const ACHIEVEMENT_CARD_VERSION = "4";

const INK = "#09090a";
const GOLD = "#dcb55f";
const MUTED = "#8b8b8b";

/** Instagram covers the top ~14% and bottom ~20% with its own chrome. */
const SAFE_TOP = 270;
const SAFE_BOTTOM = 384;

export async function renderAchievementCard(params: {
  badge: Badge;
  /**
   * "story" is 1080x1920 for posting. "og" is 1200x630, the shape every
   * platform crops a pasted link to; a 9:16 image in that slot loses its
   * middle, which is where the badge name is.
   */
  shape?: "story" | "og";
}) {
  const { badge } = params;
  const og = params.shape === "og";
  const link = "app.musicontherox.com";
  const [qr, font] = await Promise.all([
    QRCode.toDataURL(`https://${link}`, { margin: 0, width: 260, color: { dark: INK, light: "#ffffff" } }),
    anton(),
  ]);
  const display = font ? "Anton" : "sans-serif";

  const name = badge.name.toUpperCase();
  // Long names step down rather than running off the edge.
  const nameSize = og
    ? name.length > 22 ? 56 : name.length > 15 ? 70 : 86
    : name.length > 22 ? 92 : name.length > 15 ? 116 : 142;


  return new ImageResponse(
    (
      <div
        style={{
          width: og ? 1200 : 1080,
          height: og ? 630 : 1920,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: INK,
          // The same pink-into-violet bloom the story videos use, so these sit
          // in the same family as everything else that gets posted.
          backgroundImage: og
            ? "radial-gradient(720px 520px at 50% 50%, rgba(255,45,155,0.20), rgba(168,85,247,0.14) 45%, rgba(9,9,10,0) 72%)"
            : "radial-gradient(900px 760px at 50% 44%, rgba(255,45,155,0.20), rgba(168,85,247,0.14) 45%, rgba(9,9,10,0) 72%)",
          paddingTop: og ? 56 : SAFE_TOP,
          paddingBottom: og ? 48 : SAFE_BOTTOM,
          paddingLeft: og ? 64 : 80,
          paddingRight: og ? 64 : 80,
          fontFamily: display,
        }}
      >
        {/* The real mark, not the words. Its glow is baked into the pixels
            rather than carried on an alpha channel, which is why it can only
            go on something this dark — and this card is. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${APP_URL}/motr-logo.png`}
          width={og ? 240 : 400}
          height={og ? 131 : 218}
          alt="MOTR"
          style={{ display: "block" }}
        />

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", color: MUTED, fontSize: og ? 24 : 34, letterSpacing: 8 }}>
            BADGE UNLOCKED
          </div>

          <div
            style={{
              display: "flex",
              color: "#ffffff",
              fontSize: nameSize,
              lineHeight: 1.04,
              marginTop: 28,
              textAlign: "center",
            }}
          >
            {name}
          </div>

          <div style={{ display: "flex", width: og ? 120 : 180, height: 6, backgroundColor: GOLD, borderRadius: 3, marginTop: og ? 24 : 44 }} />

          <div style={{ display: "flex", color: "#d4d4d4", fontSize: og ? 28 : 40, marginTop: og ? 24 : 44, textAlign: "center", lineHeight: 1.35 }}>
            {badge.note}
          </div>

        </div>

        <div style={{ display: "flex", alignItems: "center", gap: og ? 20 : 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={og ? 96 : 150} height={og ? 96 : 150} alt="" style={{ borderRadius: 14, backgroundColor: "#fff", padding: 10 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#ffffff", fontSize: og ? 26 : 34 }}>Find new artists.</span>
            <span style={{ color: "#ffffff", fontSize: og ? 26 : 34 }}>Thirty seconds at a time.</span>
            <span style={{ color: GOLD, fontSize: og ? 24 : 32, marginTop: og ? 8 : 12 }}>{link}</span>
          </div>
        </div>
      </div>
    ),
    {
      width: og ? 1200 : 1080,
      height: og ? 630 : 1920,
      fonts: font ? [{ name: "Anton", data: font, style: "normal", weight: 400 }] : [],
      headers: {
        // Without this every scrape, preview refresh and view re-ran a
        // database query, a font download and a PNG encode.
        "cache-control": "public, max-age=3600, s-maxage=86400",
        // Netlify keys its cache on the path plus a named list of query
        // parameters. The badge is part of the path now, so only the shape
        // and the version need naming here.
        "netlify-vary": "query=shape|v",
      },
    }
  );
}
