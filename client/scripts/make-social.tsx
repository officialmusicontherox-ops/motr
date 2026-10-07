import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/**
 * Profile pictures and the Facebook cover.
 *
 * The cover is drawn at 1640x624, twice Facebook's desktop size. Facebook
 * crops it to roughly 640x360 on phones, which takes a centred slice about
 * two thirds of the width, so everything here is centred and nothing
 * important goes outside SAFE. Both profile pictures are square and get
 * masked to a circle by both platforms, so the logo stays well inside the
 * inscribed circle.
 *
 * Usage: npx tsx scripts/make-social.tsx "<out dir>"
 */

const OUT = process.argv[2] ?? ".";
const LINK = "app.musicontherox.com";

const NIGHT = "#09090a";
const BG = "#faf9f7";
const INK = "#15151a";
const MUTED = "#6b6b73";

const PINK = "#ff2d9b";
const GOLD = "#dcb55f";
const RED = "#e2574c";
const GREEN = "#2f9e63";

/** Centred width Facebook still shows after the mobile crop, of 1640. */
const SAFE = 1100;

const logo =
  "data:image/png;base64," +
  fs.readFileSync(path.join(process.cwd(), "public/motr-logo.png")).toString("base64");

async function googleFont(family: string, weight: number) {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 6.1; WOW64)" },
  }).then((r) => r.text());
  const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
  return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
}

/**
 * Three surrounds for the profile picture, because the logo is the one fixed
 * part. Both platforms mask this to a circle, so each treatment is drawn as a
 * circle that fills the square exactly and the corners are expendable.
 */

/* Dropped: a full-spectrum circle. The lighter arcs show the logo PNG's
 * baked-in bloom as grey smudges through the letterforms, the same reason
 * there is no light-background version. */
const SPECTRUM = "linear-gradient(135deg, #ff2d9b 0%, #ff5c5c 18%, #ff8a2b 34%, #dcb55f 48%, #a855f7 68%, #6d4aff 84%, #3aa8ff 100%)";

/** Gradient ring, dark middle. The logo keeps a dark ground to glow against. */
function ProfileRing() {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: NIGHT,
        backgroundImage: SPECTRUM,
        borderRadius: 540,
      }}
    >
      <div
        style={{
          width: 924,
          height: 924,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 462,
          backgroundColor: NIGHT,
          backgroundImage: `radial-gradient(540px 540px at 50% 50%, rgba(255,45,155,0.30), rgba(168,85,247,0.16) 48%, ${NIGHT} 76%)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={660} height={343} alt="" />
      </div>
    </div>
  );
}

/** Dark, but lit hard from behind in four brand colours. */
function ProfileGlow() {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 540,
        backgroundColor: NIGHT,
        backgroundImage: [
          "radial-gradient(420px 420px at 26% 32%, rgba(255,45,155,0.62), rgba(9,9,10,0) 70%)",
          "radial-gradient(400px 400px at 74% 30%, rgba(58,168,255,0.58), rgba(9,9,10,0) 70%)",
          "radial-gradient(400px 400px at 72% 72%, rgba(168,85,247,0.58), rgba(9,9,10,0) 70%)",
          "radial-gradient(380px 380px at 28% 74%, rgba(255,138,43,0.52), rgba(9,9,10,0) 70%)",
        ].join(", "),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={700} height={364} alt="" />
    </div>
  );
}

function Cover() {
  return (
    <div
      style={{
        width: 1640,
        height: 624,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: NIGHT,
        backgroundImage: `radial-gradient(1000px 760px at 50% 50%, rgba(255,45,155,0.20), rgba(168,85,247,0.10) 48%, ${NIGHT} 76%)`,
        fontFamily: "Inter",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={300} height={156} alt="" />

      <div
        style={{
          fontFamily: "Anton",
          fontSize: 58,
          lineHeight: 1.06,
          color: "#ffffff",
          display: "flex",
          textAlign: "center",
          marginTop: 14,
          maxWidth: SAFE,
        }}
      >
        THIRTY SECONDS. NO ARTIST NAME.
      </div>

      <div
        style={{
          fontSize: 27,
          lineHeight: 1.4,
          color: "#c9c9c9",
          display: "flex",
          textAlign: "center",
          marginTop: 14,
          maxWidth: 940,
        }}
      >
        You hear the song and nothing else. Free for listeners, free for artists.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: "2px solid rgba(226,87,76,0.55)",
            borderRadius: 999,
            padding: "11px 26px",
            fontSize: 22,
            fontWeight: 700,
            color: RED,
          }}
        >
          SWIPE LEFT TO PASS
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: "2px solid rgba(47,158,99,0.6)",
            borderRadius: 999,
            padding: "11px 26px",
            fontSize: 22,
            fontWeight: 700,
            color: GREEN,
          }}
        >
          SWIPE RIGHT TO KEEP
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 24 }}>
        <div style={{ display: "flex", width: 72, height: 4, backgroundColor: PINK, borderRadius: 2, marginBottom: 12 }} />
        <div style={{ fontSize: 26, fontWeight: 700, color: "#ffffff", display: "flex" }}>{LINK}</div>
      </div>
    </div>
  );
}

async function main() {
  void React;
  void GOLD;
  void INK;
  void MUTED;
  void BG;
  const [anton, inter4, inter7] = await Promise.all([
    googleFont("Anton", 400),
    googleFont("Inter", 400),
    googleFont("Inter", 700),
  ]);
  const fonts = [
    ...(anton ? [{ name: "Anton", data: anton, weight: 400 as const, style: "normal" as const }] : []),
    ...(inter4 ? [{ name: "Inter", data: inter4, weight: 400 as const, style: "normal" as const }] : []),
    ...(inter7 ? [{ name: "Inter", data: inter7, weight: 700 as const, style: "normal" as const }] : []),
  ];

  async function write(name: string, el: React.ReactElement, w: number, h: number) {
    const res = new ImageResponse(el, { width: w, height: h, fonts });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(await res.arrayBuffer()));
    console.log(`  ${name}  ${w}x${h}`);
  }

  fs.mkdirSync(OUT, { recursive: true });
  console.log(`-> ${OUT}`);
  await write("motr-profile-ring.png", <ProfileRing />, 1080, 1080);
  await write("motr-profile-glow.png", <ProfileGlow />, 1080, 1080);
  await write("motr-facebook-cover.png", <Cover />, 1640, 624);
}
main();
