import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/** Ten TikTok slideshows, five slides each, one color per deck. US spelling. */

const OUT = process.argv[2] ?? ".";
const LINK = "app.musicontherox.com";
const NIGHT = "#09090a";

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
    folder: "01 - how it works",
    accent: "#ff2d9b",
    glow: "rgba(255,45,155,0.20)",
    slides: [
      { lines: ["A MUSIC APP", "THAT HIDES", "THE ARTIST"] },
      { lines: ["YOU GET", "30 SECONDS"], sub: "No name, no follower count, no help whatsoever." },
      { lines: ["SWIPE LEFT", "OR RIGHT"], sub: "We considered a third direction. Couldn't think of one." },
      { lines: ["KEEP IT AND", "THE NAME", "SHOWS UP"], sub: "Turns out you had good taste the whole time." },
      { lines: ["TRY IT.", "IT'S FREE."], cta: true },
    ],
  },
  {
    folder: "02 - why hide the name",
    accent: "#3aa8ff",
    glow: "rgba(58,168,255,0.20)",
    slides: [
      { lines: ["YOU DECIDE", "BEFORE YOU", "SEE THE NAME"] },
      { lines: ["BECAUSE THE NAME", "DECIDES FOR YOU"], sub: "Be honest. You know within one word." },
      { lines: ["SO WE", "TOOK IT", "AWAY"], sub: "You get it back. Calm down." },
      { lines: ["WHAT'S LEFT", "IS THE SONG"], sub: "Which is what you came for, apparently." },
      { lines: ["HEAR IT", "FOR YOURSELF"], cta: true },
    ],
  },
  {
    folder: "03 - for artists",
    accent: "#ff8a2b",
    glow: "rgba(255,138,43,0.20)",
    slides: [
      { lines: ["NOBODY CLICKS", "ON UNSIGNED", "ARTISTS"] },
      { lines: ["THEY SEE THE", "NUMBERS FIRST"], sub: "Four hundred monthly listeners is a closed door." },
      { lines: ["HERE THERE ARE", "NO NUMBERS", "TO SEE"], sub: "Or a name. Or a face. Or anything." },
      { lines: ["JUST 30 SECONDS", "OF YOUR SONG"], sub: "Which is either enough or it isn't. Both are useful." },
      { lines: ["SUBMIT", "FREE"], cta: true },
    ],
  },
  {
    folder: "04 - the chart",
    accent: "#a855f7",
    glow: "rgba(168,85,247,0.20)",
    slides: [
      { lines: ["MOST CHARTS", "REWARD WHOEVER", "SPENT THE MOST"] },
      { lines: ["OURS HAS", "NOTHING TO", "SPEND ON"], sub: "We checked. There is nowhere to put the money." },
      { lines: ["NO PLACEMENT.", "NO PROMOTION.", "NO DEALS."] },
      { lines: ["JUST THE SONGS", "PEOPLE KEPT"], sub: "Deeply unglamorous. Works though." },
      { lines: ["SEE THIS", "WEEK'S CHART"], cta: true },
    ],
  },
  {
    folder: "05 - be early",
    accent: "#dcb55f",
    glow: "rgba(220,181,95,0.16)",
    slides: [
      { lines: ["EVERYONE SAYS", "THEY FOUND", "THEM FIRST"] },
      { lines: ["ALMOST NOBODY", "ACTUALLY DID"], sub: "A playlist found them. You found the playlist." },
      { lines: ["THESE ARTISTS", "DON'T HAVE", "A PLAYLIST"], sub: "Most don't have a label either." },
      { lines: ["SO FOR ONCE", "IT WOULD BE", "TRUE"] },
      { lines: ["GO FIND", "SOMEBODY"], cta: true },
    ],
  },
  {
    folder: "06 - the algorithm",
    accent: "#9ae63c",
    glow: "rgba(154,230,60,0.15)",
    slides: [
      { lines: ["YOUR MUSIC APP", "KNOWS TOO MUCH", "ABOUT YOU"] },
      { lines: ["IT PLAYS YOU", "WHAT YOU", "ALREADY LIKED"], sub: "Forever. That is the entire design." },
      { lines: ["WE KNOW", "NOTHING", "ABOUT YOU"], sub: "And we are not curious." },
      { lines: ["SO YOU GET SONGS", "INSTEAD OF", "A MIRROR"] },
      { lines: ["HEAR SOMETHING", "NEW"], cta: true },
    ],
  },
  {
    folder: "07 - full listen",
    accent: "#22d3ee",
    glow: "rgba(34,211,238,0.18)",
    slides: [
      { lines: ["MOST PEOPLE", "DECIDE IN", "THREE SECONDS"] },
      { lines: ["WHICH IS", "A BIT BRUTAL"], sub: "Someone spent a year on it. You gave it a bus stop." },
      { lines: ["SO HERE A FULL", "LISTEN COUNTS", "DOUBLE"], sub: "Twice the weight of someone who skipped." },
      { lines: ["PATIENCE IS", "WORTH MORE", "THAN SPEED"], sub: "First time that has ever been true online." },
      { lines: ["GIVE ONE", "THE FULL 30"], cta: true },
    ],
  },
  {
    folder: "08 - its free",
    accent: "#ff5c5c",
    glow: "rgba(255,92,92,0.18)",
    slides: [
      { lines: ["WHAT'S", "THE CATCH"] },
      { lines: ["THERE", "ISN'T ONE"], sub: "Free to listen. Free for artists to submit." },
      { lines: ["NO TIERS.", "NO TRIAL.", "NO UPSELL."] },
      { lines: ["WHICH IS WHY", "NOBODY BUYS", "THEIR WAY UP"], sub: "Nothing to buy with. Inconvenient for some people." },
      { lines: ["OPEN IT", "AND SEE"], cta: true },
    ],
  },
  {
    folder: "09 - what happens when you save",
    accent: "#34d399",
    glow: "rgba(52,211,153,0.16)",
    slides: [
      { lines: ["SO YOU SWIPED", "RIGHT. NOW", "WHAT?"] },
      { lines: ["THE NAME", "FINALLY", "SHOWS UP"], sub: "This is the part where you pretend you knew." },
      { lines: ["ONE TAP OPENS", "IT IN SPOTIFY"], sub: "Go follow them properly." },
      { lines: ["AND YOU CAN", "SEND IT TO", "SOMEONE"], sub: "Opens on that exact song. You look like you have taste." },
      { lines: ["GO KEEP", "SOMETHING"], cta: true },
    ],
  },
  {
    folder: "10 - why thirty seconds",
    accent: "#fbbf24",
    glow: "rgba(251,191,36,0.17)",
    slides: [
      { lines: ["WHY ONLY", "30 SECONDS?"] },
      { lines: ["YOU ALREADY", "KNOW BY THEN"], sub: "You always did. You just scrolled anyway." },
      { lines: ["LONG ENOUGH", "TO BE FAIR"], sub: "Short enough that you hear twenty of them." },
      { lines: ["TWENTY SONGS", "NOBODY TOLD", "YOU ABOUT"], sub: "In roughly ten minutes." },
      { lines: ["START", "SWIPING"], cta: true },
    ],
  },
  {
    folder: "11 - the swipe",
    accent: "#f43f5e",
    glow: "rgba(244,63,94,0.19)",
    slides: [
      { lines: ["LEFT FOR NO.", "RIGHT FOR YES."] },
      { lines: ["THAT IS THE", "ENTIRE", "INTERFACE"], sub: "We considered a third direction. Nothing came to mind." },
      { lines: ["NO STARS.", "NO RATINGS.", "NO COMMENTS."], sub: "Nobody needs your five-paragraph review." },
      { lines: ["A THUMB AND", "THIRTY SECONDS"], sub: "That is the whole commitment." },
      { lines: ["GO ON", "THEN"], cta: true },
    ],
  },
  {
    folder: "12 - swipe left guilt free",
    accent: "#14b8a6",
    glow: "rgba(20,184,166,0.18)",
    slides: [
      { lines: ["SWIPING LEFT", "FEELS HARSH"] },
      { lines: ["NOT HERE", "IT DOESN'T"], sub: "You do not know whose it is. Neither does anyone else." },
      { lines: ["NO NAME.", "NO FEELINGS", "INVOLVED."], sub: "Just whether the song did anything for you." },
      { lines: ["SWIPE LEFT", "GUILT FREE"], sub: "They will never know. There is nothing to know." },
      { lines: ["TRY BEING", "HONEST"], cta: true },
    ],
  },
  {
    folder: "13 - twenty swipes",
    accent: "#eab308",
    glow: "rgba(234,179,8,0.17)",
    slides: [
      { lines: ["HOW LONG DOES", "THIS ACTUALLY", "TAKE?"] },
      { lines: ["ABOUT TEN", "MINUTES"], sub: "Twenty songs, thirty seconds each, minus the ones you skip." },
      { lines: ["TWENTY ARTISTS", "NOBODY TOLD", "YOU ABOUT"], sub: "None of them paid to be in front of you." },
      { lines: ["YOU WILL KEEP", "ABOUT ONE"], sub: "That one is the entire point." },
      { lines: ["TEN MINUTES.", "GO."], cta: true },
    ],
  },
  {
    folder: "14 - what a right swipe does",
    accent: "#e879f9",
    glow: "rgba(232,121,249,0.19)",
    slides: [
      { lines: ["WHAT DOES", "SWIPING RIGHT", "ACTUALLY DO?"] },
      { lines: ["IT TELLS YOU", "WHO MADE IT"], sub: "Finally. The name was hidden until you decided." },
      { lines: ["IT SAVES THE", "SONG FOR YOU"], sub: "One tap from Spotify, whenever you want it." },
      { lines: ["AND IT MOVES", "THEM UP", "THE CHART"], sub: "That is the only thing that moves anyone up it." },
      { lines: ["SO SWIPE", "CAREFULLY"], cta: true },
    ],
  },
];

function Slide({ d, s, n }: { d: Deck; s: Slide; n: number }) {
  const longest = Math.max(...s.lines.map((l) => l.length));
  const size = longest > 18 ? 88 : longest > 14 ? 104 : longest > 10 ? 122 : 142;
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
        paddingBottom: 290,
        paddingLeft: 80,
        paddingRight: 80,
        backgroundColor: NIGHT,
        backgroundImage: `radial-gradient(900px 820px at 50% 45%, ${d.glow}, ${NIGHT} 72%)`,
        fontFamily: "Inter",
        position: "relative",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={300} height={156} alt="" />

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
          <div style={{ marginTop: 38, fontSize: 36, lineHeight: 1.4, color: "#c9c9c9", display: "flex", textAlign: "center", maxWidth: 820 }}>
            {s.sub}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex" }}>
        {s.cta ? (
          <div style={{ display: "flex", backgroundColor: d.accent, borderRadius: 999, padding: "26px 58px", fontSize: 40, fontWeight: 700, color: NIGHT }}>
            {LINK}
          </div>
        ) : (
          <div style={{ fontSize: 26, letterSpacing: 5, color: "#4a4a4a", fontWeight: 700, display: "flex" }}>
            KEEP WATCHING
          </div>
        )}
      </div>

      {/* The order marker, small and bottom right, so the deck can be uploaded
          in sequence without opening each file. */}
      <div
        style={{
          position: "absolute",
          right: 54,
          bottom: 200,
          fontSize: 34,
          fontWeight: 700,
          color: d.accent,
          opacity: 0.55,
          display: "flex",
        }}
      >
        {n}
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
    const dir = path.join(OUT, d.folder);
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < d.slides.length; i++) {
      const res = new ImageResponse(<Slide d={d} s={d.slides[i]} n={i + 1} />, { width: 1080, height: 1920, fonts });
      fs.writeFileSync(path.join(dir, `slide-${i + 1}.png`), Buffer.from(await res.arrayBuffer()));
    }
    console.log(`  ${d.folder}`);
  }
  console.log(`\n${decks.length} decks, ${decks.length * 5} slides -> ${OUT}`);
}
main();
