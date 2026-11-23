import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/**
 * Thanksgiving week Spotlight graphics, 23 to 30 November 2026,, in story
 * (1080x1920) and post (1080x1080) sizes. Same house style as make-stats.
 *
 *   npx tsx scripts/make-stats-nov17.tsx "<output folder>"
 *
 * Figures are people who actually swiped or voted, never page visits,
 * which crawlers inflate.
 *
 * Originally: story graphics built from the numbers, 1080x1920.
 *
 * Same house style as make-stories: logo-led, Anton headline, accent wash,
 * link pill at the foot. Two layouts: a hook card for a single figure, and a
 * list card for a ranking. The list cards carry no counts on purpose, so a
 * place reads as a place rather than as a small number.
 */

const OUT = process.argv[2] ?? ".";
const LINK = "app.musicontherox.com";

const INK = "#09090a";
const BODY = "#c9c9c9";
const MUTED = "#8b8b8b";
const PINK = "#ff2d9b";
const ORANGE = "#ff8a2b";
const BLUE = "#3aa8ff";
const GOLD = "#dcb55f";
const PURPLE = "#a855f7";

const logo =
  "data:image/png;base64," +
  fs.readFileSync(path.join(process.cwd(), "public/motr-logo.png")).toString("base64");

let antonCache: ArrayBuffer | null | undefined;
async function anton(): Promise<ArrayBuffer | null> {
  if (antonCache !== undefined) return antonCache;
  try {
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


const CYAN = "#38c6f4";

type Card = {
  file: string;
  dir: string;
  kind: "hook" | "list" | "grid";
  accent: string;
  glow: string;
  kicker: string;
  figure?: string;
  lines?: string[];
  title?: string;
  items?: string[];
  highlight?: string[];
  sub: string;
  tag: string;
  sizes: ("story" | "post")[];
};

const SWIPE = "SWIPE. KEEP WHAT YOU LIKE.";
const FIGHT = "TWO SONGS. HEAD TO HEAD. YOU DECIDE.";
const BACK = "BACK THE ARTISTS YOU LOVE.";
const BOTH: ("story" | "post")[] = ["story", "post"];

const COUNTRIES = [
  "United States", "Canada", "Germany", "United Kingdom", "Denmark",
  "France", "Switzerland", "Sweden", "Spain", "Australia",
  "The Netherlands", "Austria", "Croatia", "Italy", "Slovakia",
  "Czechia", "Brazil", "Kazakhstan", "Belgium", "Norway",
  "Argentina", "Vietnam", "Finland", "Bangladesh", "Nigeria",
  "Qatar", "Costa Rica", "Greece", "Tunisia", "Israel",
];

const cards: Card[] = [
  { dir: ".", file: "01-thanksgiving-bonus", kind: "hook", accent: GOLD, glow: "rgba(220,181,95,0.2)", kicker: "THANKSGIVING WEEK", figure: "+3 FREE", lines: ["SPOTLIGHTS"], sub: "Buy 10 Spotlights, get 3 free. Buy 3, get 1 free. Through Monday, November 30.", tag: BACK, sizes: BOTH },
  { dir: ".", file: "02-back-an-artist", kind: "hook", accent: ORANGE, glow: "rgba(255,138,43,0.18)", kicker: "THANKSGIVING WEEK", lines: ["GIVE AN ARTIST", "THE SPOTLIGHT"], sub: "Put an independent artist you love on the Spotlight tab for three days. Bonus Spotlights on every bundle through Monday, November 30.", tag: BACK, sizes: BOTH },
];

type Size = "story" | "post";
const DIM = { story: { w: 1080, h: 1920 }, post: { w: 1080, h: 1080 } };

function shell(c: Card, size: Size, inner: React.ReactNode) {
  const story = size === "story";
  return (
    <div
      style={{
        width: 1080,
        height: DIM[size].h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: story ? 130 : 60,
        paddingBottom: story ? 215 : 60,
        paddingLeft: story ? 90 : 70,
        paddingRight: story ? 90 : 70,
        fontFamily: "sans-serif",
        backgroundImage: `radial-gradient(${story ? "900px 700px at 50% 22%" : "820px 560px at 50% 18%"}, ${c.glow}, ${INK} 70%)`,
        backgroundColor: INK,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={story ? 620 : 330} height={story ? 322 : 171} alt="" />
        <div style={{ marginTop: story ? 18 : 10, fontSize: story ? 24 : 20, letterSpacing: story ? 9 : 7, color: c.accent, fontWeight: 700, display: "flex" }}>
          {c.kicker}
        </div>
      </div>

      {inner}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", border: `3px solid ${c.accent}`, borderRadius: 999, padding: story ? "22px 56px" : "14px 40px", fontSize: story ? 40 : 30, fontWeight: 700, color: "#ffffff" }}>
          {LINK}
        </div>
        <div style={{ marginTop: story ? 22 : 14, fontSize: story ? 24 : 18, letterSpacing: story ? 5 : 4, color: MUTED, display: "flex" }}>
          {c.tag}
        </div>
      </div>
    </div>
  );
}

function hookBody(c: Card, size: Size, display: string) {
  const story = size === "story";
  const lines = c.lines ?? [];
  const longest = Math.max(...lines.map((l) => l.length));
  const base = longest > 15 ? 84 : longest > 13 ? 92 : longest > 10 ? 104 : 118;
  const lineSize = story ? base : Math.round(base * (c.figure ? 0.6 : 0.72));
  const fig = c.figure ?? "";
  const figSize = story ? (fig.length > 5 ? 190 : 240) : fig.length > 5 ? 120 : 150;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {c.figure && (
        <div style={{ fontFamily: display, fontSize: figSize, lineHeight: 1, color: c.accent, display: "flex" }}>{c.figure}</div>
      )}
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: display,
            fontSize: c.figure ? lineSize : Math.round(lineSize * 1.12),
            lineHeight: 1.02,
            color: !c.figure && i === lines.length - 1 ? c.accent : "#ffffff",
            display: "flex",
            textAlign: "center",
            marginTop: i === 0 && c.figure ? (story ? 14 : 8) : 0,
          }}
        >
          {line}
        </div>
      ))}
      <div style={{ marginTop: story ? 40 : 22, fontSize: story ? 32 : 24, lineHeight: 1.45, color: BODY, display: "flex", textAlign: "center", maxWidth: story ? 780 : 820 }}>
        {c.sub}
      </div>
    </div>
  );
}

function gridBody(c: Card, display: string) {
  const items = c.items ?? [];
  const half = Math.ceil(items.length / 2);
  const columns = [items.slice(0, half), items.slice(half)];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <div style={{ fontFamily: display, fontSize: 64, lineHeight: 1.02, color: "#ffffff", display: "flex", marginBottom: 18 }}>{c.title}</div>
      <div style={{ display: "flex", gap: 18, width: "100%", justifyContent: "center" }}>
        {columns.map((col, ci) => (
          <div key={ci} style={{ display: "flex", flexDirection: "column", flex: 1, maxWidth: 430 }}>
            {col.map((item) => {
              const hot = (c.highlight ?? []).includes(item);
              return (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "5px 12px",
                    marginBottom: 6,
                    borderRadius: 14,
                    background: hot ? "rgba(58,168,255,0.10)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${hot ? "rgba(58,168,255,0.45)" : "rgba(255,255,255,0.09)"}`,
                    fontFamily: display,
                    fontSize: 29,
                    color: hot ? c.accent : "#ffffff",
                  }}
                >
                  {item}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, fontSize: 28, lineHeight: 1.4, color: BODY, display: "flex", textAlign: "center", maxWidth: 820 }}>{c.sub}</div>
    </div>
  );
}

function listBody(c: Card, size: Size, display: string) {
  const story = size === "story";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: story ? 780 : 720 }}>
      <div style={{ fontFamily: display, fontSize: story ? 70 : 48, lineHeight: 1.02, color: "#ffffff", display: "flex", marginBottom: story ? 26 : 14 }}>{c.title}</div>
      {(c.items ?? []).map((item, i) => (
        <div
          key={item}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding: story ? "10px 24px" : "3px 20px",
            marginBottom: story ? 8 : 5,
            borderRadius: story ? 16 : 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ fontFamily: display, fontSize: story ? 34 : 24, width: 56, marginRight: 18, color: i < 3 ? c.accent : MUTED, display: "flex", justifyContent: "flex-end" }}>{i + 1}</div>
          <div style={{ fontSize: story ? 38 : 26, color: "#ffffff", display: "flex" }}>{item}</div>
          <div style={{ width: 56, display: "flex" }} />
        </div>
      ))}
      <div style={{ marginTop: story ? 22 : 10, fontSize: story ? 28 : 20, lineHeight: 1.4, color: BODY, display: "flex", textAlign: "center", maxWidth: 760 }}>{c.sub}</div>
    </div>
  );
}

async function main() {
  void React;
  const font = await anton();
  const display = font ? "Anton" : "sans-serif";
  let n = 0;
  for (const c of cards) {
    for (const size of c.sizes) {
      const inner =
        c.kind === "hook" ? hookBody(c, size, display) : c.kind === "grid" ? gridBody(c, display) : listBody(c, size, display);
      const res = new ImageResponse(shell(c, size, inner), {
        width: 1080,
        height: DIM[size].h,
        fonts: font ? [{ name: "Anton", data: font, style: "normal", weight: 400 }] : [],
      });
      const buf = Buffer.from(await res.arrayBuffer());
      const dir = path.join(OUT, c.dir);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `motr-${c.file}-${size}.png`);
      fs.writeFileSync(file, buf);
      n += 1;
      console.log(`  ${c.dir}/${path.basename(file)}`);
    }
  }
  console.log(`\n  ${n} graphics written to ${OUT}`);
}
main();
