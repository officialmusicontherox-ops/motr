import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/** Ten story graphics for MOTR's own socials. 1080x1920, logo-led. */

const OUT = process.argv[2] ?? ".";
const LINK = "app.musicontherox.com";

const INK = "#09090a";
const BODY = "#c9c9c9";
const MUTED = "#8b8b8b";

// Pulled from the logo itself so the accents belong to the brand.
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

type Card = {
  file: string;
  accent: string;
  /** Small line above the headline. */
  kicker: string;
  /** The hook, in Anton. Lines are drawn separately so they break where intended. */
  lines: string[];
  /** Supporting sentence under the hook. */
  sub: string;
  glow: string;
};

const cards: Card[] = [
  {
    file: "01-thirty-seconds",
    accent: PINK,
    kicker: "MUSIC ON THE ROX",
    lines: ["YOU'LL KNOW", "IN THIRTY", "SECONDS"],
    sub: "Thirty-second clips from artists you have never heard. Keep the ones that land.",
    glow: "rgba(255,45,155,0.18)",
  },
  {
    file: "02-no-names",
    accent: BLUE,
    kicker: "NO NAMES ATTACHED",
    lines: ["YOU DON'T", "GET TO SEE", "WHO MADE IT"],
    sub: "Not until you keep it. Decide on the song, then find out whose it was.",
    glow: "rgba(58,168,255,0.18)",
  },
  {
    file: "03-before-everyone",
    accent: ORANGE,
    kicker: "GET THERE FIRST",
    lines: ["HEAR IT", "BEFORE", "EVERYONE"],
    sub: "New music from artists nobody has heard yet. Swipe what moves you.",
    glow: "rgba(255,138,43,0.18)",
  },
  {
    file: "04-cant-buy",
    accent: PURPLE,
    kicker: "NOTHING IS FOR SALE",
    lines: ["NOBODY", "BUYS THEIR", "WAY IN"],
    sub: "There is nothing to buy. A song moves up because people kept it, and for no other reason.",
    glow: "rgba(168,85,247,0.18)",
  },
  {
    file: "05-your-call",
    accent: GOLD,
    kicker: "YOUR EARS DECIDE",
    lines: ["NO ALGORITHM", "TELLING YOU", "WHAT TO LIKE"],
    sub: "Thirty seconds, no name attached, your call. That is the whole thing.",
    glow: "rgba(220,181,95,0.16)",
  },
  {
    file: "06-next-favourite",
    accent: PINK,
    kicker: "SOMEWHERE IN THE QUEUE",
    lines: ["YOUR NEXT", "FAVOURITE", "SONG"],
    sub: "By someone with no marketing budget and nobody telling you to listen.",
    glow: "rgba(255,45,155,0.18)",
  },
  {
    file: "07-saved-spotify",
    accent: BLUE,
    kicker: "KEEP WHAT YOU LIKE",
    lines: ["SWIPE RIGHT.", "OPEN IT", "IN SPOTIFY."],
    sub: "Everything you keep lands in Saved with the artist named, one tap from Spotify.",
    glow: "rgba(58,168,255,0.18)",
  },
  {
    file: "08-free",
    accent: ORANGE,
    kicker: "FREE, AND STAYS FREE",
    lines: ["NOTHING", "TO PAY.", "EVER."],
    sub: "Free for listeners, free for artists. Nobody is charged anything.",
    glow: "rgba(255,138,43,0.18)",
  },
  {
    file: "09-artists-submit",
    accent: GOLD,
    kicker: "ARTISTS, THIS IS FOR YOU",
    lines: ["GET HEARD", "WITH NO", "NAME ON IT"],
    sub: "Submit free. Real listeners hear thirty seconds and decide on the music alone.",
    glow: "rgba(220,181,95,0.16)",
  },
  {
    file: "10-one-swipe",
    accent: PURPLE,
    kicker: "START NOW",
    lines: ["ONE SWIPE", "AND YOU'RE", "IN"],
    sub: "No setup, no hunting. Open it and the first song is already playing.",
    glow: "rgba(168,85,247,0.18)",
  },
  {
    file: "11-vote-with-ears",
    accent: BLUE,
    kicker: "NO FOLLOWER COUNTS",
    lines: ["VOTE WITH", "YOUR EARS,", "NOT YOUR FEED"],
    sub: "You cannot see who made it, so what you are judging is the song.",
    glow: "rgba(58,168,255,0.18)",
  },
  {
    file: "12-unsigned",
    accent: PINK,
    kicker: "UNSIGNED AND UNHEARD",
    lines: ["THE BEST SONG", "YOU HEAR TODAY", "HAS NO LABEL"],
    sub: "Independent artists, thirty seconds each, no marketing in the way.",
    glow: "rgba(255,45,155,0.18)",
  },
  {
    file: "13-built-by-listeners",
    accent: GOLD,
    kicker: "A CHART THAT MEANS IT",
    lines: ["BUILT BY", "LISTENERS.", "NOT LABELS."],
    sub: "Every position was earned by people keeping the song. There is no other way up.",
    glow: "rgba(220,181,95,0.16)",
  },
  {
    file: "14-one-you-keep",
    accent: ORANGE,
    kicker: "TAKES TWO MINUTES",
    lines: ["FIVE SONGS.", "ONE YOU", "KEEP."],
    sub: "That is usually how it goes. The one you keep is the point.",
    glow: "rgba(255,138,43,0.18)",
  },
  {
    file: "15-stop-being-sold",
    accent: PURPLE,
    kicker: "NOTHING IS PROMOTED",
    lines: ["STOP HEARING", "WHAT YOU'RE", "SOLD"],
    sub: "Nothing in the feed paid to be there, and there is no way to buy a place in it.",
    glow: "rgba(168,85,247,0.18)",
  },
  {
    file: "16-full-listen",
    accent: GOLD,
    kicker: "PATIENCE COUNTS",
    lines: ["HEAR IT OUT", "AND YOUR VOTE", "COUNTS DOUBLE"],
    sub: "Listen to the whole clip before deciding and it carries twice the weight.",
    glow: "rgba(220,181,95,0.16)",
  },
  {
    file: "17-artists-free",
    accent: PINK,
    kicker: "ARTISTS",
    lines: ["FREE ENTRY.", "HONEST", "VERDICT."],
    sub: "Send us a track. Real listeners hear it with no name attached and tell you the truth.",
    glow: "rgba(255,45,155,0.18)",
  },
  {
    file: "18-no-account-hunting",
    accent: BLUE,
    kicker: "OPEN AND GO",
    lines: ["NO FEED.", "NO SEARCH.", "JUST SONGS."],
    sub: "Nothing to scroll past and nothing to look up. The first track is already waiting.",
    glow: "rgba(58,168,255,0.18)",
  },
  {
    file: "19-tell-a-friend",
    accent: ORANGE,
    kicker: "FOUND SOMETHING GOOD?",
    lines: ["BE THE ONE", "WHO FOUND", "THEM FIRST"],
    sub: "Keep it, see who made it, and send them to everyone before anybody else does.",
    glow: "rgba(255,138,43,0.18)",
  },
  {
    file: "20-every-day",
    accent: PURPLE,
    kicker: "NEW EVERY WEEK",
    lines: ["MORE MUSIC", "NOBODY HAS", "HEARD YET"],
    sub: "Artists send new tracks every week. There is always something you have not heard.",
    glow: "rgba(168,85,247,0.18)",
  },
];

async function draw(c: Card, font: ArrayBuffer | null) {
  const display = font ? "Anton" : "sans-serif";
  const longest = Math.max(...c.lines.map((l) => l.length));
  const size = longest > 13 ? 96 : longest > 10 ? 112 : 128;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1920,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          // Instagram puts the profile row over the top of a story and the
          // reply bar over the bottom, so nothing important goes in either.
          paddingTop: 130,
          paddingBottom: 215,
          paddingLeft: 90,
          paddingRight: 90,
          fontFamily: "sans-serif",
          // A wash of the accent behind the logo, so each card reads as its
          // own without leaving the palette.
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

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {c.lines.map((line, i) => (
            <div
              key={i}
              style={{
                fontFamily: display,
                fontSize: size,
                lineHeight: 1.02,
                color: i === c.lines.length - 1 ? c.accent : "#ffffff",
                display: "flex",
                textAlign: "center",
              }}
            >
              {line}
            </div>
          ))}
          <div
            style={{
              marginTop: 40,
              fontSize: 34,
              lineHeight: 1.45,
              color: BODY,
              display: "flex",
              textAlign: "center",
              maxWidth: 760,
            }}
          >
            {c.sub}
          </div>
        </div>

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
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: font ? [{ name: "Anton", data: font, style: "normal", weight: 400 }] : [],
    }
  );
}

async function main() {
  void React;
  const font = await anton();
  fs.mkdirSync(OUT, { recursive: true });
  for (const c of cards) {
    const res = await draw(c, font);
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(OUT, `motr-story-${c.file}.png`);
    fs.writeFileSync(file, buf);
    console.log(`  ${path.basename(file)}  ${Math.round(buf.length / 1024)}KB`);
  }
  console.log(`\n${cards.length} graphics written to ${OUT}`);
}
main();
