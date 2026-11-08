import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/**
 * Story graphics built from the numbers, 1080x1920.
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

type Hook = {
  kind: "hook";
  file: string;
  accent: string;
  glow: string;
  kicker: string;
  /** The one figure, as big as it goes. */
  figure: string;
  lines: string[];
  sub: string;
};

type Grid = {
  kind: "grid";
  file: string;
  accent: string;
  glow: string;
  kicker: string;
  title: string;
  items: string[];
  /** Drawn in the accent, because these are the ones worth a second look. */
  highlight: string[];
  sub: string;
};

type List = {
  kind: "list";
  file: string;
  accent: string;
  glow: string;
  kicker: string;
  title: string;
  items: string[];
  sub: string;
};

const cards: (Hook | List | Grid)[] = [
  {
    kind: "hook",
    file: "01-music-heard",
    accent: ORANGE,
    glow: "rgba(255,138,43,0.18)",
    kicker: "SINCE LAUNCH",
    figure: "+872%",
    lines: ["MORE MUSIC", "HEARD"],
    sub: "Songs judged by real people, comparing our first month to right now.",
  },
  {
    kind: "hook",
    file: "02-artists",
    accent: GOLD,
    glow: "rgba(220,181,95,0.16)",
    kicker: "SINCE LAUNCH",
    figure: "+492%",
    lines: ["MORE ARTISTS", "SUBMITTING"],
    sub: "Independent artists putting their music in front of strangers who judge the song alone.",
  },
  {
    kind: "hook",
    file: "03-saved",
    accent: PINK,
    glow: "rgba(255,45,155,0.18)",
    kicker: "SINCE LAUNCH",
    figure: "+189%",
    lines: ["MORE SONGS", "SAVED"],
    sub: "Kept by listeners who heard thirty seconds and never saw a name.",
  },
  {
    kind: "hook",
    file: "04-listeners",
    accent: BLUE,
    glow: "rgba(58,168,255,0.18)",
    kicker: "SINCE LAUNCH",
    figure: "+149%",
    lines: ["MORE", "LISTENERS"],
    sub: "Arriving to decide on music with nothing to go on but the music.",
  },
  {
    kind: "hook",
    file: "05-countries",
    accent: PURPLE,
    glow: "rgba(168,85,247,0.16)",
    kicker: "SINCE LAUNCH",
    figure: "+2,100%",
    lines: ["MORE", "COUNTRIES"],
    sub: "One country in our first month. Twenty-two now, and nobody paid to be there.",
  },
  {
    kind: "hook",
    file: "06-states",
    accent: GOLD,
    glow: "rgba(220,181,95,0.16)",
    kicker: "SINCE LAUNCH",
    figure: "+2,800%",
    lines: ["MORE STATES", "AND REGIONS"],
    sub: "From two to fifty-eight, all judging music with no name attached.",
  },
  {
    kind: "list",
    file: "08-top-countries",
    accent: PURPLE,
    glow: "rgba(168,85,247,0.16)",
    kicker: "WHERE THEY'RE LISTENING",
    title: "TOP TEN COUNTRIES",
    items: [
      "United States",
      "Canada",
      "United Kingdom",
      "Denmark",
      "Brazil",
      "Kazakhstan",
      "Switzerland",
      "Germany",
      "Australia",
      "Argentina",
    ],
    sub: "Twenty-two countries have swiped since launch. These ten lead.",
  },
  {
    kind: "list",
    file: "09-top-states",
    accent: GOLD,
    glow: "rgba(220,181,95,0.16)",
    kicker: "ACROSS THE STATES",
    title: "TOP TEN STATES",
    items: [
      "Texas",
      "California",
      "South Carolina",
      "Illinois",
      "Michigan",
      "Tennessee",
      "Wisconsin",
      "Arkansas",
      "Minnesota",
      "Georgia",
    ],
    sub: "Fifty-eight states and regions in all, judging music with no name attached.",
  },
  {
    kind: "hook",
    file: "11-artists-saved",
    accent: GOLD,
    glow: "rgba(220,181,95,0.16)",
    kicker: "THE WHOLE POINT",
    figure: "85%",
    lines: ["OF ARTISTS", "GET SAVED"],
    sub: "Kept by a complete stranger who had never heard of them and never saw their name.",
  },
  {
    kind: "hook",
    file: "12-tracks-saved",
    accent: PINK,
    glow: "rgba(255,45,155,0.18)",
    kicker: "NOTHING SINKS QUIETLY",
    figure: "77%",
    lines: ["OF SONGS", "FIND SOMEONE"],
    sub: "More than three quarters have been saved by at least one person who judged the music and nothing else.",
  },
  {
    kind: "hook",
    file: "13-hours-kept",
    accent: PINK,
    glow: "rgba(255,45,155,0.18)",
    kicker: "SINCE LAUNCH",
    figure: "90",
    lines: ["HOURS OF MUSIC", "KEPT"],
    sub: "Nearly four straight days of songs people chose to hold onto, every one by an artist they had never heard of.",
  },
  {
    kind: "hook",
    file: "14-hours-catalogue",
    accent: ORANGE,
    glow: "rgba(255,138,43,0.18)",
    kicker: "IN ROTATION RIGHT NOW",
    figure: "33",
    lines: ["HOURS OF", "INDEPENDENT MUSIC"],
    sub: "No label decided any of it should be there. Nobody paid for a place in the queue.",
  },
  {
    kind: "hook",
    file: "15-every-19-minutes",
    accent: BLUE,
    glow: "rgba(58,168,255,0.18)",
    kicker: "DAY AND NIGHT",
    figure: "19",
    lines: ["MINUTES BETWEEN", "EVERY VERDICT"],
    sub: "Somewhere, someone is deciding on a song they have never heard, around the clock since August.",
  },
  {
    kind: "grid",
    file: "10-all-countries",
    accent: BLUE,
    glow: "rgba(58,168,255,0.18)",
    kicker: "EVERY ONE OF THEM",
    title: "22 COUNTRIES",
    items: [
      "United States", "Canada", "United Kingdom", "Denmark", "Brazil",
      "Kazakhstan", "Switzerland", "Germany", "Australia", "Argentina",
      "The Netherlands", "Italy", "Vietnam", "Finland", "Sweden",
      "Spain", "France", "Slovakia", "Qatar", "Greece",
      "Costa Rica", "Tunisia",
    ],
    highlight: ["Kazakhstan", "Vietnam", "Slovakia", "Qatar", "Costa Rica", "Tunisia"],
    sub: "Independent music, no names attached, judged in all twenty-two. Nobody paid to be heard in any of them.",
  },
];

function shell(c: Hook | List | Grid, display: string, inner: React.ReactNode) {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        // Instagram covers the top and bottom of a story with its own chrome.
        paddingTop: 130,
        paddingBottom: 215,
        paddingLeft: 90,
        paddingRight: 90,
        fontFamily: "sans-serif",
        backgroundImage: `radial-gradient(900px 700px at 50% 22%, ${c.glow}, ${INK} 70%)`,
        backgroundColor: INK,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={620} height={322} alt="" />
        <div
          style={{
            marginTop: 18,
            fontSize: 24,
            letterSpacing: 9,
            color: c.accent,
            fontWeight: 700,
            display: "flex",
          }}
        >
          {c.kicker}
        </div>
      </div>

      {inner}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            border: `3px solid ${c.accent}`,
            borderRadius: 999,
            padding: "22px 56px",
            fontSize: 40,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {LINK}
        </div>
        <div style={{ marginTop: 22, fontSize: 24, letterSpacing: 5, color: MUTED, display: "flex" }}>
          SWIPE. KEEP WHAT YOU LIKE.
        </div>
      </div>
      {void display}
    </div>
  );
}

function hookBody(c: Hook, display: string) {
  const longest = Math.max(...c.lines.map((l) => l.length));
  const size = longest > 13 ? 92 : longest > 10 ? 104 : 118;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          fontFamily: display,
          fontSize: c.figure.length > 5 ? 190 : 240,
          lineHeight: 1,
          color: c.accent,
          display: "flex",
        }}
      >
        {c.figure}
      </div>
      {c.lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: display,
            fontSize: size,
            lineHeight: 1.02,
            color: "#ffffff",
            display: "flex",
            textAlign: "center",
            marginTop: i === 0 ? 14 : 0,
          }}
        >
          {line}
        </div>
      ))}
      <div
        style={{
          marginTop: 40,
          fontSize: 32,
          lineHeight: 1.45,
          color: BODY,
          display: "flex",
          textAlign: "center",
          maxWidth: 780,
        }}
      >
        {c.sub}
      </div>
    </div>
  );
}

function gridBody(c: Grid, display: string) {
  const half = Math.ceil(c.items.length / 2);
  const columns = [c.items.slice(0, half), c.items.slice(half)];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <div
        style={{
          fontFamily: display,
          fontSize: 76,
          lineHeight: 1.02,
          color: "#ffffff",
          display: "flex",
          marginBottom: 28,
        }}
      >
        {c.title}
      </div>
      <div style={{ display: "flex", gap: 22, width: "100%", justifyContent: "center" }}>
        {columns.map((col, ci) => (
          <div key={ci} style={{ display: "flex", flexDirection: "column", flex: 1, maxWidth: 430 }}>
            {col.map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "11px 14px",
                  marginBottom: 8,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${
                    c.highlight.includes(item) ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)"
                  }`,
                  fontSize: 34,
                  color: c.highlight.includes(item) ? c.accent : "#ffffff",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 28,
          lineHeight: 1.45,
          color: BODY,
          display: "flex",
          textAlign: "center",
          maxWidth: 820,
        }}
      >
        {c.sub}
      </div>
    </div>
  );
}

function listBody(c: List, display: string) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: 780,
      }}
    >
      <div
        style={{
          fontFamily: display,
          fontSize: 70,
          lineHeight: 1.02,
          color: "#ffffff",
          display: "flex",
          marginBottom: 26,
        }}
      >
        {c.title}
      </div>
      {c.items.map((item, i) => (
        <div
          key={item}
          style={{
            display: "flex",
            alignItems: "center",
            // Centred as a block, with the rank and the name together in the
            // middle rather than pinned to opposite edges.
            justifyContent: "center",
            width: "100%",
            padding: "10px 24px",
            marginBottom: 8,
            borderRadius: 16,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              fontFamily: display,
              fontSize: 34,
              width: 56,
              textAlign: "right",
              marginRight: 18,
              color: i < 3 ? c.accent : MUTED,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            {i + 1}
          </div>
          <div style={{ fontSize: 38, color: "#ffffff", display: "flex" }}>{item}</div>
          <div style={{ width: 56, display: "flex" }} />
        </div>
      ))}
      <div
        style={{
          marginTop: 22,
          fontSize: 28,
          lineHeight: 1.45,
          color: BODY,
          display: "flex",
          textAlign: "center",
          maxWidth: 780,
        }}
      >
        {c.sub}
      </div>
    </div>
  );
}

async function draw(c: Hook | List | Grid, font: ArrayBuffer | null) {
  const display = font ? "Anton" : "sans-serif";
  const inner =
    c.kind === "hook" ? hookBody(c, display)
    : c.kind === "grid" ? gridBody(c, display)
    : listBody(c, display);
  return new ImageResponse(shell(c, display, inner), {
    width: 1080,
    height: 1920,
    fonts: font ? [{ name: "Anton", data: font, style: "normal", weight: 400 }] : [],
  });
}

async function main() {
  void React;
  const font = await anton();
  fs.mkdirSync(OUT, { recursive: true });
  for (const c of cards) {
    const res = await draw(c, font);
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(OUT, `motr-stat-${c.file}.png`);
    fs.writeFileSync(file, buf);
    console.log(`  ${path.basename(file)}  ${Math.round(buf.length / 1024)}KB`);
  }
  console.log(`\n  ${cards.length} graphics written to ${OUT}`);
}
main();
