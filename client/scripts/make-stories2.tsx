import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/** Fifty more story slides. US spelling throughout. */

const OUT = process.argv[2] ?? ".";
const LINK = "app.musicontherox.com";
const NIGHT = "#09090a";
const PINK = "#ff2d9b";
const ORANGE = "#ff8a2b";
const BLUE = "#3aa8ff";
const VIOLET = "#a855f7";
const GOLD = "#dcb55f";
const LIME = "#9ae63c";

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

type Card = { lines: string[]; sub?: string; accent: string };

const A = [PINK, ORANGE, BLUE, VIOLET, GOLD, LIME];
const glow = (c: string) =>
  ({
    [PINK]: "rgba(255,45,155,0.18)",
    [ORANGE]: "rgba(255,138,43,0.18)",
    [BLUE]: "rgba(58,168,255,0.18)",
    [VIOLET]: "rgba(168,85,247,0.18)",
    [GOLD]: "rgba(220,181,95,0.16)",
    [LIME]: "rgba(154,230,60,0.15)",
  })[c] ?? "rgba(255,255,255,0.08)";

// ---- dry humor -------------------------------------------------------------
const humor: Card[] = [
  { lines: ["THIRTY SECONDS.", "WHICH IS 29 MORE", "THAN YOU GAVE", "THE LAST SONG."], accent: ORANGE },
  { lines: ["A MUSIC APP", "WITH NO OPINIONS", "ABOUT YOU"], sub: "We genuinely have no idea what you listened to last summer.", accent: BLUE },
  { lines: ["NOBODY PAID US", "TO SHOW YOU THIS"], sub: "Obviously. Look at it.", accent: PINK },
  { lines: ["THE ALGORITHM", "IS YOU.", "SORRY."], accent: VIOLET },
  { lines: ["WE'D TELL YOU", "WHO MADE IT, BUT", "THAT RUINS IT"], accent: GOLD },
  { lines: ["THIRTY SECONDS", "IS A LONG TIME", "IF IT'S BAD"], sub: "You can swipe early. We won't tell them.", accent: ORANGE },
  { lines: ["FINALLY, A CHART", "YOUR COUSIN'S BAND", "CAN GET ON"], accent: LIME },
  { lines: ["NO ONE HAS EVER", "BEEN PRESSURED INTO", "LIKING ANYTHING HERE"], accent: BLUE },
  { lines: ["YOUR TASTE,", "UNSUPERVISED"], sub: "Nobody is watching. There is nothing to watch with.", accent: PINK },
  { lines: ["ZERO MARKETING", "BUDGETS WERE HARMED", "MAKING THIS FEED"], accent: VIOLET },
  { lines: ["WE PUT THE", "ARTIST'S NAME", "SOMEWHERE SAFE"], sub: "You get it back when you keep the song.", accent: GOLD },
  { lines: ["AN APP THAT", "DOESN'T KNOW", "WHO YOU ARE"], sub: "And frankly isn't curious.", accent: ORANGE },
  { lines: ["NO ONE'S MANAGER", "HAS EVER CALLED", "US ABOUT THIS"], sub: "There is nothing they could ask for.", accent: BLUE },
  { lines: ["YOU'VE SKIPPED", "BETTER SONGS", "THAN THIS"], sub: "Statistically. Give this one the full thirty.", accent: PINK },
  { lines: ["LEFT FOR NO.", "RIGHT FOR YES.", "THAT'S IT."], sub: "We considered a third direction. Nothing came to mind.", accent: LIME },
  { lines: ["NO PREMIUM TIER.", "NO FREE TRIAL.", "NO TIER AT ALL."], accent: GOLD },
  { lines: ["THE WORST THING", "THAT HAPPENS IS", "YOU SWIPE LEFT"], sub: "Thirty seconds. That is the entire risk.", accent: VIOLET },
];

// ---- creative --------------------------------------------------------------
const creative: Card[] = [
  { lines: ["SWIPE RIGHT", "AND IT'S", "YOURS"], sub: "Saved, with the name finally attached, one tap from Spotify.", accent: BLUE },
  { lines: ["SOMEWHERE IN HERE", "IS A SONG YOU", "PLAY 200 TIMES"], sub: "You just haven't met it yet.", accent: PINK },
  { lines: ["MUSIC WITH NO", "RESUME ATTACHED"], sub: "No followers, no label, no history. Just the song.", accent: GOLD },
  { lines: ["YOU'LL KNOW", "BY SECOND NINE"], sub: "You always do. The other twenty-one are for being sure.", accent: ORANGE },
  { lines: ["EVERY SONG HERE", "IS A STRANGER"], sub: "Some of them won't be, by the end of the week.", accent: VIOLET },
  { lines: ["THE NAME COMES", "AFTER THE VERDICT"], sub: "Which is the only order that has ever made sense.", accent: BLUE },
  { lines: ["A ROOM WHERE", "NOBODY KNOWS", "WHO'S PLAYING"], accent: LIME },
  { lines: ["THIS IS WHAT", "A SONG SOUNDS LIKE", "WITH NO HYPE ON IT"], accent: PINK },
  { lines: ["SOMEONE SPENT", "A YEAR ON THIS.", "GIVE IT THIRTY SECONDS."], accent: GOLD },
  { lines: ["BE EARLY", "FOR ONCE"], sub: "Everyone says they found a band first. Here you actually can.", accent: ORANGE },
  { lines: ["NO COVER ART", "YOU RECOGNIZE.", "NO NAME YOU KNOW."], sub: "Only whether it moves you.", accent: VIOLET },
  { lines: ["THE CHART", "RESETS SUNDAY", "AT MIDNIGHT"], sub: "Everything on it was put there by people keeping songs.", accent: BLUE },
  { lines: ["YOUR EARS,", "WITH NOTHING", "WHISPERING AT THEM"], accent: LIME },
  { lines: ["ONE SONG IN HERE", "IS ABOUT TO BE", "SOMEBODY'S FAVORITE"], sub: "It could be yours.", accent: PINK },
  { lines: ["JUDGED BLIND.", "LIKE IT SHOULD", "ALWAYS HAVE BEEN."], accent: GOLD },
  { lines: ["A CHART MADE", "ENTIRELY OF", "SMALL DECISIONS"], sub: "Thirty seconds at a time, by people like you.", accent: ORANGE },
  { lines: ["THE SONG DOESN'T", "KNOW WHO YOU ARE", "EITHER"], sub: "Fair fight.", accent: VIOLET },
];

// ---- straight --------------------------------------------------------------
const straight: Card[] = [
  { lines: ["THIRTY SECONDS", "TO DECIDE"], sub: "Swipe right to keep it. It lands in Saved with the artist named.", accent: BLUE },
  { lines: ["FREE.", "ALL OF IT.", "ALWAYS."], sub: "Free to listen, free to submit, nothing to buy anywhere in it.", accent: LIME },
  { lines: ["KEEP IT AND", "OPEN IT IN", "SPOTIFY"], sub: "One tap from Saved, once you know whose it is.", accent: GOLD },
  { lines: ["FOUND SOMETHING", "GOOD? SEND IT", "TO SOMEONE."], sub: "The link opens on that exact song.", accent: PINK },
  { lines: ["A FULL LISTEN", "COUNTS DOUBLE"], sub: "Hear the whole clip and your vote carries twice the weight.", accent: ORANGE },
  { lines: ["NOTHING HERE", "CAN BE BOUGHT"], sub: "No placement, no promotion, no deals. There is nothing to sell.", accent: VIOLET },
  { lines: ["NEW MUSIC", "EVERY WEEK"], sub: "Artists send tracks constantly. There is always something unheard.", accent: BLUE },
  { lines: ["ARTISTS:", "SEND US", "A TRACK"], sub: "Free. It goes out with no name on it and real people decide.", accent: GOLD },
  { lines: ["NO FEED.", "NO SEARCH.", "JUST SONGS."], sub: "Open it and the first one is already waiting.", accent: LIME },
  { lines: ["THE WEEK RUNS", "SUNDAY TO", "SATURDAY"], sub: "Then the chart closes and a new one starts.", accent: ORANGE },
  { lines: ["SWIPE LEFT", "FOR NO.", "RIGHT FOR YES."], sub: "That is the whole interface.", accent: PINK },
  { lines: ["EVERYTHING YOU", "KEEP IS SAVED", "FOR YOU"], sub: "With who made it, and a way to go hear more.", accent: VIOLET },
  { lines: ["THE ARTIST'S NAME", "IS HIDDEN UNTIL", "YOU SAVE IT"], accent: BLUE },
  { lines: ["POSITION IS EARNED", "BY PEOPLE KEEPING", "THE SONG"], sub: "That is the only thing that moves anything.", accent: GOLD },
  { lines: ["MOSTLY ARTISTS", "YOU HAVE NEVER", "HEARD OF"], sub: "That is the point, not a limitation.", accent: LIME },
  { lines: ["NO ACCOUNT", "TO SET UP"], sub: "Sign in and start swiping. Nothing to configure.", accent: ORANGE },
];

const all: { file: string; card: Card }[] = [
  ...humor.map((c, i) => ({ file: `humor-${String(i + 1).padStart(2, "0")}`, card: c })),
  ...creative.map((c, i) => ({ file: `creative-${String(i + 1).padStart(2, "0")}`, card: c })),
  ...straight.map((c, i) => ({ file: `straight-${String(i + 1).padStart(2, "0")}`, card: c })),
];

function Story({ c }: { c: Card }) {
  const longest = Math.max(...c.lines.map((l) => l.length));
  const size = longest > 22 ? 68 : longest > 17 ? 80 : longest > 13 ? 94 : 112;
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 130,
        paddingBottom: 215,
        paddingLeft: 86,
        paddingRight: 86,
        backgroundColor: NIGHT,
        backgroundImage: `radial-gradient(900px 760px at 50% 40%, ${glow(c.accent)}, ${NIGHT} 72%)`,
        fontFamily: "Inter",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={420} height={218} alt="" />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {c.lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: "Anton",
              fontSize: size,
              lineHeight: 1.04,
              color: i === c.lines.length - 1 ? c.accent : "#ffffff",
              display: "flex",
              textAlign: "center",
            }}
          >
            {l}
          </div>
        ))}
        {c.sub ? (
          <div style={{ marginTop: 36, fontSize: 34, lineHeight: 1.42, color: "#c9c9c9", display: "flex", textAlign: "center", maxWidth: 800 }}>
            {c.sub}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", border: `3px solid ${c.accent}`, borderRadius: 999, padding: "22px 54px", fontSize: 38, fontWeight: 700, color: "#ffffff" }}>
        {LINK}
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
  for (const { file, card } of all) {
    const res = new ImageResponse(<Story c={card} />, { width: 1080, height: 1920, fonts });
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT, `motr-${file}.png`), buf);
  }
  console.log(`${all.length} slides written to ${OUT}`);
}
main();
