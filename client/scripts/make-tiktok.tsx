import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/**
 * TikTok slideshows: four stories, five slides each.
 *
 * Built to be read at scroll speed. One idea per slide, six words at most,
 * and the type sized so it carries on a phone held at arm's length. The last
 * slide of every set is the only one that asks for anything.
 */

const ROOT = process.argv[2] ?? ".";
const LINK = "app.musicontherox.com";
const NIGHT = "#09090a";
const PINK = "#ff2d9b";
const ORANGE = "#ff8a2b";
const BLUE = "#3aa8ff";
const VIOLET = "#a855f7";

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

type Slide = { lines: string[]; sub?: string; cta?: boolean };
type Deck = { folder: string; accent: string; glow: string; slides: Slide[] };

const decks: Deck[] = [
  {
    folder: "1 - how it works",
    accent: PINK,
    glow: "rgba(255,45,155,0.20)",
    slides: [
      { lines: ["AN APP THAT", "HIDES THE", "ARTIST'S NAME"] },
      { lines: ["YOU GET", "30 SECONDS"], sub: "That is the whole audition." },
      { lines: ["SWIPE LEFT", "OR RIGHT"], sub: "No stars, no reviews, no comments." },
      { lines: ["KEEP IT AND", "YOU FIND OUT", "WHO IT WAS"], sub: "It lands in Saved, one tap from Spotify." },
      { lines: ["TRY IT", "FREE"], cta: true },
    ],
  },
  {
    folder: "2 - why its different",
    accent: BLUE,
    glow: "rgba(58,168,255,0.20)",
    slides: [
      { lines: ["EVERY MUSIC APP", "TELLS YOU WHAT", "TO LIKE"] },
      { lines: ["PLAYLISTS YOU", "DIDN'T PICK"], sub: "Chosen for you, by someone with something to sell." },
      { lines: ["ALGORITHMS", "FED ON WHAT", "YOU ALREADY PLAY"], sub: "So you hear more of the same." },
      { lines: ["WE SHOW YOU", "A SONG WITH", "NO NAME ON IT"], sub: "You decide. Nothing else gets a vote." },
      { lines: ["HEAR IT", "FOR YOURSELF"], cta: true },
    ],
  },
  {
    folder: "3 - for artists",
    accent: ORANGE,
    glow: "rgba(255,138,43,0.20)",
    slides: [
      { lines: ["NOBODY LISTENS", "TO UNSIGNED", "ARTISTS"] },
      { lines: ["THEY SEE THE", "FOLLOWER COUNT", "FIRST"], sub: "And decide before the song starts." },
      { lines: ["HERE THEY", "SEE NOTHING"], sub: "No name, no numbers, no history." },
      { lines: ["JUST 30 SECONDS", "OF THE SONG"], sub: "What comes back is a verdict on the music." },
      { lines: ["SUBMIT", "FREE"], cta: true },
    ],
  },
  {
    folder: "4 - the chart",
    accent: VIOLET,
    glow: "rgba(168,85,247,0.20)",
    slides: [
      { lines: ["MOST CHARTS", "REWARD WHOEVER", "SPENT THE MOST"] },
      { lines: ["OURS HAS", "NOTHING TO", "SPEND ON"], sub: "There is literally nothing to buy." },
      { lines: ["NO PLACEMENT.", "NO PROMOTION.", "NO DEALS."] },
      { lines: ["JUST THE SONGS", "PEOPLE KEPT"], sub: "That is the only input there is." },
      { lines: ["SEE THIS", "WEEK'S CHART"], cta: true },
    ],
  },
];

function Slide({ d, s, n, total }: { d: Deck; s: Slide; n: number; total: number }) {
  const longest = Math.max(...s.lines.map((l) => l.length));
  const size = longest > 16 ? 96 : longest > 12 ? 116 : 140;
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 150,
        paddingBottom: 300,
        paddingLeft: 80,
        paddingRight: 80,
        backgroundColor: NIGHT,
        backgroundImage: `radial-gradient(900px 800px at 50% 45%, ${d.glow}, ${NIGHT} 72%)`,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={200} height={104} alt="" />
        <div style={{ fontSize: 26, letterSpacing: 4, color: "#6b6b6b", fontWeight: 700, display: "flex" }}>
          {n}/{total}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {s.lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: "Anton",
              fontSize: size,
              lineHeight: 1.02,
              color: i === s.lines.length - 1 ? d.accent : "#ffffff",
              display: "flex",
              textAlign: "center",
            }}
          >
            {l}
          </div>
        ))}
        {s.sub ? (
          <div style={{ marginTop: 38, fontSize: 36, lineHeight: 1.4, color: "#c9c9c9", display: "flex", textAlign: "center", maxWidth: 800 }}>
            {s.sub}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {s.cta ? (
          <div style={{ display: "flex", backgroundColor: d.accent, borderRadius: 999, padding: "26px 60px", fontSize: 42, fontWeight: 700, color: NIGHT }}>
            {LINK}
          </div>
        ) : (
          <div style={{ fontSize: 28, letterSpacing: 5, color: "#4a4a4a", fontWeight: 700, display: "flex" }}>
            KEEP WATCHING
          </div>
        )}
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

  for (const d of decks) {
    const dir = path.join(ROOT, d.folder);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`\n${d.folder}`);
    for (let i = 0; i < d.slides.length; i++) {
      const res = new ImageResponse(<Slide d={d} s={d.slides[i]} n={i + 1} total={d.slides.length} />, {
        width: 1080,
        height: 1920,
        fonts,
      });
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(path.join(dir, `slide-${i + 1}.png`), buf);
      console.log(`  slide-${i + 1}.png  ${Math.round(buf.length / 1024)}KB`);
    }
  }
  console.log("\ndone");
}
main();
