import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/**
 * Twenty-five feed squares with the stories' energy.
 *
 * The first set was drawn in the app's light theme on purpose, to look like
 * the product. It did, and it read flat beside the neon stories. These keep
 * the brand but borrow the stories' treatment: dark ground, one accent, type
 * doing the work.
 */

const OUT = process.argv[2] ?? ".";
const LINK = "app.musicontherox.com";
const NIGHT = "#09090a";

const PINK = "#ff2d9b";
const BLUE = "#3aa8ff";
const ORANGE = "#ff8a2b";
const VIOLET = "#a855f7";
const GOLD = "#dcb55f";
const LIME = "#9ae63c";
const CYAN = "#22d3ee";
const CORAL = "#ff5c5c";

const GLOW: Record<string, string> = {
  [PINK]: "rgba(255,45,155,0.20)",
  [BLUE]: "rgba(58,168,255,0.20)",
  [ORANGE]: "rgba(255,138,43,0.20)",
  [VIOLET]: "rgba(168,85,247,0.20)",
  [GOLD]: "rgba(220,181,95,0.17)",
  [LIME]: "rgba(154,230,60,0.16)",
  [CYAN]: "rgba(34,211,238,0.18)",
  [CORAL]: "rgba(255,92,92,0.18)",
};

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

type Sq = { file: string; a: string; lines: string[]; sub?: string; stat?: string };

const squares: Sq[] = [
  { file: "s01", a: PINK, lines: ["WE HID THE", "ARTIST'S NAME.", "YOU'RE WELCOME."], sub: "You'd have judged it. Be honest." },
  { file: "s02", a: BLUE, lines: ["LEFT FOR NO.", "RIGHT FOR YES."], sub: "We considered a third direction. Nothing came to mind." },
  { file: "s03", a: LIME, lines: ["NO PREMIUM", "TIER TO", "UPGRADE TO"], sub: "There is one tier. You're on it." },
  { file: "s04", a: VIOLET, lines: ["THE ALGORITHM", "IS YOU"], sub: "We hold no data on you and have no plans to." },
  { file: "s05", a: ORANGE, lines: ["THIRTY SECONDS,", "THEN YOU DECIDE"], sub: "Generous, by modern standards.", stat: "0:30" },
  { file: "s06", a: GOLD, lines: ["NOBODY'S MANAGER", "HAS EVER CALLED US"], sub: "There is nothing they could ask for." },
  { file: "s07", a: CYAN, lines: ["A CHART WITH", "NO MARKETING", "BUDGET IN IT"], sub: "Mostly because nobody here has one." },
  { file: "s08", a: CORAL, lines: ["YOU'VE SKIPPED", "BETTER SONGS", "THAN THIS"], sub: "Probably today. Give this one the full thirty." },
  { file: "s09", a: BLUE, lines: ["WE DON'T KNOW", "WHAT YOU PLAYED", "LAST SUMMER"], sub: "And we are not going to ask." },
  { file: "s10", a: LIME, lines: ["FREE.", "STILL FREE.", "ALWAYS WAS."], sub: "For listeners and for artists. Nothing to buy." },
  { file: "s11", a: PINK, lines: ["A THUMB AND", "THIRTY SECONDS"], sub: "That is the entire commitment. Swipe left and it is over." },
  { file: "s12", a: GOLD, lines: ["FINALLY, A CHART", "YOUR FRIEND'S BAND", "COULD GET ON"], sub: "No budget required. There is nowhere to spend one." },
  { file: "s13", a: VIOLET, lines: ["NO PLAYLIST", "CURATOR WAS", "CONSULTED"], sub: "We didn't ask anyone. That is rather the point." },
  { file: "s14", a: ORANGE, lines: ["SOMEONE SPENT", "A YEAR ON", "THIS SONG"], sub: "You are about to give it thirty seconds. Make them count." },
  { file: "s15", a: CYAN, lines: ["WE PUT THE NAME", "SOMEWHERE SAFE"], sub: "You get it back the moment you keep the song." },
  { file: "s16", a: GOLD, lines: ["A FULL LISTEN", "COUNTS DOUBLE"], sub: "Patience rewarded. Rare, online.", stat: "2x" },
  { file: "s17", a: BLUE, lines: ["SWIPING, BUT FOR", "THINGS THAT", "SOUND GOOD"], sub: "No feed to scroll. No search bar. Just the next song." },
  { file: "s18", a: CORAL, lines: ["NOBODY WILL SEE", "YOUR FOLLOWER", "COUNT"], sub: "Artists: including us. Free to submit." },
  { file: "s19", a: LIME, lines: ["THE SONG DOESN'T", "KNOW WHO YOU", "ARE EITHER"], sub: "Fair fight." },
  { file: "s20", a: PINK, lines: ["YOUR NEXT", "FAVORITE SONG", "IS IN HERE"], sub: "Made by somebody with no idea you exist." },
  { file: "s21", a: VIOLET, lines: ["NOTHING IN THIS", "FEED PAID TO", "BE HERE"], sub: "There is no mechanism. We would have to build one." },
  { file: "s22", a: ORANGE, lines: ["YOU CAN SEND IT", "TO SOMEONE NOW"], sub: "Opens on that exact song. You will look discerning." },
  { file: "s23", a: CYAN, lines: ["SWIPE LEFT", "GUILT-FREE"], sub: "Nobody's name is attached. They will never know." },
  { file: "s24", a: GOLD, lines: ["TWENTY SWIPES.", "TEN MINUTES.", "ONE KEEPER."], sub: "That is usually how it goes.", stat: "20" },
  { file: "s25", a: PINK, lines: ["THE CHART RESETS", "SUNDAY AT", "MIDNIGHT"], sub: "Everything on it was put there by people keeping songs." },
];

function Square({ c }: { c: Sq }) {
  const longest = Math.max(...c.lines.map((l) => l.length));
  const size = longest > 20 ? 54 : longest > 16 ? 64 : longest > 12 ? 74 : 86;
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 76,
        backgroundColor: NIGHT,
        backgroundImage: `radial-gradient(820px 700px at 50% 44%, ${GLOW[c.a]}, ${NIGHT} 72%)`,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={250} height={130} alt="" />
        {c.stat ? (
          <div style={{ fontFamily: "Anton", fontSize: 76, color: c.a, display: "flex", opacity: 0.9 }}>
            {c.stat}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {c.lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: "Anton",
              fontSize: size,
              lineHeight: 1.06,
              color: i === c.lines.length - 1 ? c.a : "#ffffff",
              display: "flex",
            }}
          >
            {l}
          </div>
        ))}
        {c.sub ? (
          <div style={{ marginTop: 26, fontSize: 30, lineHeight: 1.45, color: "#c9c9c9", display: "flex", maxWidth: 860 }}>
            {c.sub}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", width: 58, height: 4, backgroundColor: c.a, borderRadius: 2, marginRight: 18 }} />
        <div style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", display: "flex" }}>{LINK}</div>
      </div>
    </div>
  );
}

async function main() {
  void React;
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

  fs.mkdirSync(OUT, { recursive: true });
  for (const c of squares) {
    const res = new ImageResponse(<Square c={c} />, { width: 1080, height: 1080, fonts });
    fs.writeFileSync(path.join(OUT, `motr-${c.file}.png`), Buffer.from(await res.arrayBuffer()));
  }
  console.log(`${squares.length} squares -> ${OUT}`);
}
main();
