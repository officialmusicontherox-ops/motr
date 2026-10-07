import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/**
 * Every feed square, centered, plus blank templates to drop photos into.
 *
 * The first two sets hung all their type off the left edge. At thumbnail size
 * in a grid that reads as lopsided rather than deliberate, so everything here
 * is centred on the vertical axis instead.
 *
 * Three groups:
 *   s01-s25  the neon set, dark ground and one accent
 *   f01-f20  the app-styled set, light ground and a card
 *   blanks   logo at the top, link at the bottom, nothing in between
 *
 * Usage: npx tsx scripts/make-feed-centered.tsx "<out dir>" "<blanks dir>"
 */

const OUT = process.argv[2] ?? ".";
const BLANKS = process.argv[3] ?? path.join(OUT, "Blanks");
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

/* the app's own light palette, for the f set */
const BG = "#faf9f7";
const SURFACE = "#ffffff";
const SURFACE2 = "#f5f3ef";
const EDGE = "#e4e1db";
const INK = "#15151a";
const MUTED = "#6b6b73";
const RED = "#e2574c";
const GREEN = "#2f9e63";

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

/* ------------------------------------------------------------- neon squares */

type Sq = { file: string; a: string; lines: string[]; sub?: string; stat?: string };

const neon: Sq[] = [
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

function Neon({ c }: { c: Sq }) {
  const longest = Math.max(...c.lines.map((l) => l.length));
  const size = longest > 20 ? 54 : longest > 16 ? 64 : longest > 12 ? 74 : 86;
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 76,
        backgroundColor: NIGHT,
        backgroundImage: `radial-gradient(820px 700px at 50% 44%, ${GLOW[c.a]}, ${NIGHT} 72%)`,
        fontFamily: "Inter",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={250} height={130} alt="" />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {c.stat ? (
          <div
            style={{
              fontFamily: "Anton",
              fontSize: 72,
              color: c.a,
              display: "flex",
              opacity: 0.9,
              marginBottom: 22,
            }}
          >
            {c.stat}
          </div>
        ) : null}

        {c.lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: "Anton",
              fontSize: size,
              lineHeight: 1.06,
              color: i === c.lines.length - 1 ? c.a : "#ffffff",
              display: "flex",
              textAlign: "center",
            }}
          >
            {l}
          </div>
        ))}

        {c.sub ? (
          <div
            style={{
              marginTop: 26,
              fontSize: 30,
              lineHeight: 1.45,
              color: "#c9c9c9",
              display: "flex",
              maxWidth: 820,
              textAlign: "center",
            }}
          >
            {c.sub}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", width: 72, height: 4, backgroundColor: c.a, borderRadius: 2, marginBottom: 18 }} />
        <div style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", display: "flex" }}>{LINK}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- app squares */

type Card = { file: string; label: string; head: string; body: string; kind: "swipe" | "plain" | "stat"; stat?: string };

const app: Card[] = [
  { file: "f01", label: "HOW IT WORKS", head: "Thirty seconds, no artist name.", body: "You hear the song and nothing else. Decide on the music, then find out whose it was.", kind: "swipe" },
  { file: "f02", label: "HOW IT WORKS", head: "Swipe right and it is yours.", body: "Everything you keep lands in Saved with the artist named, one tap from Spotify.", kind: "swipe" },
  { file: "f03", label: "THE RULE", head: "Nobody can buy a place in the feed.", body: "There is nothing to buy. A song moves up because people kept it, and for no other reason.", kind: "plain" },
  { file: "f04", label: "FOR LISTENERS", head: "Hear it before anyone tells you to.", body: "Independent artists, most of them unsigned, most of them you have never heard of.", kind: "plain" },
  { file: "f05", label: "FOR ARTISTS", head: "Free entry. Honest verdict.", body: "Send a track. Real listeners hear it with no name attached and decide on the music alone.", kind: "plain" },
  { file: "f06", label: "WORTH KNOWING", head: "A full listen counts double.", body: "Hear the whole clip before deciding and your vote carries twice the weight.", kind: "stat", stat: "2x" },
  { file: "f07", label: "THE CHART", head: "Built by listeners, not labels.", body: "Every position was earned by people keeping the song. There is no other route up.", kind: "plain" },
  { file: "f08", label: "NO CATCH", head: "Free, and it stays free.", body: "Free for listeners and free for artists. Nobody is charged anything, ever.", kind: "plain" },
  { file: "f09", label: "HOW IT WORKS", head: "No feed. No search. Just songs.", body: "Nothing to scroll past and nothing to look up. The first track is already waiting.", kind: "swipe" },
  { file: "f10", label: "THE POINT", head: "You are judging the song.", body: "Not the follower count, not the artwork you recognize, not who told you about it.", kind: "plain" },
  { file: "f11", label: "FOR ARTISTS", head: "Your name is hidden on purpose.", body: "So what comes back is a verdict on the track rather than on your following.", kind: "plain" },
  { file: "f12", label: "EVERY WEEK", head: "New music, every single week.", body: "Artists send tracks constantly. There is always something nobody has heard yet.", kind: "plain" },
  { file: "f13", label: "WORTH KNOWING", head: "Thirty seconds is all you get.", body: "It is usually all you need. You know by the end of the clip whether it is yours.", kind: "stat", stat: "0:30" },
  { file: "f14", label: "FOR LISTENERS", head: "Be the one who found them first.", body: "Keep it, see who made it, then send them to everyone before anyone else does.", kind: "plain" },
  { file: "f15", label: "THE CHART", head: "Ranks only. No numbers to game.", body: "Position is earned by listeners keeping the song, and there is no way to buy one.", kind: "plain" },
  { file: "f16", label: "HOW IT WORKS", head: "Left for no. Right for yes.", body: "That is the whole interface. Nothing to learn and nothing to set up.", kind: "swipe" },
  { file: "f17", label: "FOR ARTISTS", head: "No gatekeeper reads your email.", body: "It goes straight to listeners. What you get back is what people actually did.", kind: "plain" },
  { file: "f18", label: "THE POINT", head: "Music before the marketing.", body: "No campaign, no playlist pitch, no algorithm deciding for you beforehand.", kind: "plain" },
  { file: "f19", label: "WORTH KNOWING", head: "Your saves are the chart.", body: "Nothing else feeds it. What listeners keep is the only input there is.", kind: "plain" },
  { file: "f20", label: "START HERE", head: "One swipe and you are in.", body: "No setup. Open it and the first song starts playing.", kind: "swipe" },
];

function AppCard({ c }: { c: Card }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: BG,
        padding: 72,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={230} height={120} alt="" />
        <div style={{ fontSize: 19, letterSpacing: 4, color: MUTED, fontWeight: 600, display: "flex", marginTop: 10 }}>
          {c.label}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", width: "100%" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: SURFACE,
            border: `2px solid ${EDGE}`,
            borderRadius: 32,
            padding: 52,
          }}
        >
          {c.kind === "stat" && (
            <div style={{ fontFamily: "Anton", fontSize: 128, lineHeight: 1, color: GOLD, display: "flex", marginBottom: 18 }}>
              {c.stat}
            </div>
          )}
          <div style={{ fontSize: 56, lineHeight: 1.18, color: INK, fontWeight: 700, display: "flex", textAlign: "center" }}>
            {c.head}
          </div>
          <div style={{ marginTop: 22, fontSize: 30, lineHeight: 1.5, color: MUTED, display: "flex", textAlign: "center" }}>
            {c.body}
          </div>

          {c.kind === "swipe" && (
            <div style={{ display: "flex", gap: 18, marginTop: 38, width: "100%" }}>
              <div style={{ display: "flex", flexGrow: 1, justifyContent: "center", alignItems: "center", border: `2px solid ${EDGE}`, backgroundColor: SURFACE2, borderRadius: 20, padding: "22px 0", fontSize: 26, fontWeight: 700, color: RED }}>
                NOPE
              </div>
              <div style={{ display: "flex", flexGrow: 1, justifyContent: "center", alignItems: "center", border: `2px solid ${EDGE}`, backgroundColor: SURFACE2, borderRadius: 20, padding: "22px 0", fontSize: 26, fontWeight: 700, color: GREEN }}>
                LIKE
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: GOLD, display: "flex" }}>{LINK}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- blanks */

const COLORS: { name: string; a: string }[] = [
  { name: "pink", a: PINK },
  { name: "blue", a: BLUE },
  { name: "orange", a: ORANGE },
  { name: "violet", a: VIOLET },
  { name: "gold", a: GOLD },
  { name: "lime", a: LIME },
  { name: "cyan", a: CYAN },
  { name: "coral", a: CORAL },
];

/**
 * Deliberately empty between the logo and the link. A photo dropped into the
 * middle has to sit on flat ground, so there is no frame or caption to fight
 * with and nothing to crop around.
 */
function Blank({ a, w, h }: { a: string; w: number; h: number }) {
  const tall = h > w;
  return (
    <div
      style={{
        width: w,
        height: h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: tall ? "120px 76px 150px" : "76px 76px 86px",
        backgroundColor: NIGHT,
        backgroundImage: `radial-gradient(${tall ? "900px 1100px" : "820px 700px"} at 50% 46%, ${GLOW[a]}, ${NIGHT} 74%)`,
        fontFamily: "Inter",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={tall ? 290 : 250} height={tall ? 150 : 130} alt="" />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", width: 72, height: 4, backgroundColor: a, borderRadius: 2, marginBottom: 18 }} />
        <div style={{ fontSize: tall ? 32 : 28, fontWeight: 700, color: "#ffffff", display: "flex" }}>{LINK}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- run */

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

  async function write(dir: string, name: string, el: React.ReactElement, w: number, h: number) {
    const res = new ImageResponse(el, { width: w, height: h, fonts });
    fs.writeFileSync(path.join(dir, name), Buffer.from(await res.arrayBuffer()));
    process.stdout.write(".");
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(BLANKS, { recursive: true });

  console.log(`Neon squares -> ${OUT}`);
  for (const c of neon) await write(OUT, `motr-${c.file}.png`, <Neon c={c} />, 1080, 1080);

  console.log(`\nApp squares -> ${OUT}`);
  for (const c of app) await write(OUT, `motr-${c.file}.png`, <AppCard c={c} />, 1080, 1080);

  console.log(`\nBlanks -> ${BLANKS}`);
  for (const { name, a } of COLORS) {
    await write(BLANKS, `motr-blank-post-${name}.png`, <Blank a={a} w={1080} h={1080} />, 1080, 1080);
    await write(BLANKS, `motr-blank-story-${name}.png`, <Blank a={a} w={1080} h={1920} />, 1080, 1920);
  }

  console.log(`\n\n${neon.length + app.length} squares, ${COLORS.length * 2} blanks`);
}
main();
