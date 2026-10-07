import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import { leadersBetween } from "../lib/scoutData";
import { weekOf } from "../lib/weekWindow";

/**
 * Marketing graphics for MOTR's own channels.
 *
 * Three sets: Halloween stories, square feed cards drawn in the app's own
 * light theme, and chart cards built from the real week.
 */

const ROOT = process.argv[2] ?? ".";
const LINK = "app.musicontherox.com";

// The app's light palette, lifted from globals.css so these look like the
// product rather than like an advert for it.
const BG = "#faf9f7";
const SURFACE = "#ffffff";
const SURFACE2 = "#efede8";
const EDGE = "#e0ddd5";
const GOLD = "#8a6d3a";
const INK = "#16161a";
const MUTED = "#67655f";
const GREEN = "#2f8f2a";
const RED = "#c02138";

// Dark, for the Halloween set.
const NIGHT = "#09090a";
const PUMPKIN = "#ff7a18";
const SLIME = "#7ddf3c";
const VIOLET = "#a855f7";

const logo =
  "data:image/png;base64," +
  fs.readFileSync(path.join(process.cwd(), "public/motr-logo.png")).toString("base64");

async function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 6.1; WOW64)" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

async function dataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

let FONTS: { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" }[] = [];

async function write(dir: string, file: string, el: React.ReactElement, w: number, h: number) {
  const res = new ImageResponse(el, { width: w, height: h, fonts: FONTS });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), buf);
  console.log(`  ${file}  ${Math.round(buf.length / 1024)}KB`);
}

/* ---------------------------------------------------------------- Halloween */

type Story = { file: string; accent: string; kicker: string; lines: string[]; sub: string; glow: string };

const halloween: Story[] = [
  { file: "h1-no-idea", accent: PUMPKIN, kicker: "NOBODY KNOWS WHO IT IS", lines: ["THE SCARIEST", "PART IS NOT", "KNOWING"], sub: "Every song plays with no artist name attached. You find out after you keep it.", glow: "rgba(255,122,24,0.20)" },
  { file: "h2-graveyard", accent: SLIME, kicker: "DIG SOMETHING UP", lines: ["UNEARTH A", "SONG NOBODY", "HAS HEARD"], sub: "Thirty seconds each, from artists with no label and no marketing budget.", glow: "rgba(125,223,60,0.16)" },
  { file: "h3-trick-or-treat", accent: VIOLET, kicker: "TRICK OR TREAT", lines: ["SWIPE LEFT", "FOR TRICK.", "RIGHT FOR TREAT."], sub: "Keep the ones that land. They turn up in Saved with the artist named.", glow: "rgba(168,85,247,0.20)" },
  { file: "h4-haunt", accent: PUMPKIN, kicker: "IT WILL STAY WITH YOU", lines: ["ONE OF THESE", "IS GOING TO", "HAUNT YOU"], sub: "In the good way. Thirty seconds is usually all it takes to know.", glow: "rgba(255,122,24,0.20)" },
  { file: "h5-no-tricks", accent: SLIME, kicker: "NO TRICKS HERE", lines: ["NOTHING", "PAID TO BE", "IN THE FEED"], sub: "There is nothing to buy. A song climbs because people kept it, and for no other reason.", glow: "rgba(125,223,60,0.16)" },
  { file: "h6-midnight", accent: VIOLET, kicker: "SOMETHING FOR THE DARK", lines: ["MIDNIGHT", "MUSIC FOR", "MIDNIGHT PEOPLE"], sub: "Free, no names attached, and a new one every time you swipe.", glow: "rgba(168,85,247,0.20)" },
];

function Story({ c }: { c: Story }) {
  const longest = Math.max(...c.lines.map((l) => l.length));
  const size = longest > 15 ? 86 : longest > 11 ? 102 : 120;
  return (
    <div style={{ width: 1080, height: 1920, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", paddingTop: 130, paddingBottom: 215, paddingLeft: 90, paddingRight: 90, backgroundColor: NIGHT, backgroundImage: `radial-gradient(900px 700px at 50% 22%, ${c.glow}, ${NIGHT} 70%)`, fontFamily: "Inter" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={600} height={312} alt="" />
        <div style={{ marginTop: 18, fontSize: 24, letterSpacing: 9, color: c.accent, fontWeight: 700, display: "flex" }}>{c.kicker}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {c.lines.map((l, i) => (
          <div key={i} style={{ fontFamily: "Anton", fontSize: size, lineHeight: 1.02, color: i === c.lines.length - 1 ? c.accent : "#ffffff", display: "flex", textAlign: "center" }}>{l}</div>
        ))}
        <div style={{ marginTop: 40, fontSize: 34, lineHeight: 1.45, color: "#c9c9c9", display: "flex", textAlign: "center", maxWidth: 780 }}>{c.sub}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", border: `3px solid ${c.accent}`, borderRadius: 999, padding: "22px 56px", fontSize: 40, fontWeight: 700, color: "#ffffff" }}>{LINK}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ feed squares */

type Square = { file: string; label: string; head: string; body: string; kind: "swipe" | "plain" | "stat"; stat?: string };

const squares: Square[] = [
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

function Square({ c }: { c: Square }) {
  return (
    <div style={{ width: 1080, height: 1080, display: "flex", flexDirection: "column", backgroundColor: BG, padding: 72, fontFamily: "Inter" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={230} height={120} alt="" />
        <div style={{ fontSize: 19, letterSpacing: 4, color: MUTED, fontWeight: 600, display: "flex" }}>{c.label}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", marginTop: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", backgroundColor: SURFACE, border: `2px solid ${EDGE}`, borderRadius: 32, padding: 52 }}>
          {c.kind === "stat" && (
            <div style={{ fontFamily: "Anton", fontSize: 128, lineHeight: 1, color: GOLD, display: "flex", marginBottom: 18 }}>{c.stat}</div>
          )}
          <div style={{ fontSize: 56, lineHeight: 1.18, color: INK, fontWeight: 700, display: "flex" }}>{c.head}</div>
          <div style={{ marginTop: 22, fontSize: 30, lineHeight: 1.5, color: MUTED, display: "flex" }}>{c.body}</div>

          {c.kind === "swipe" && (
            <div style={{ display: "flex", gap: 18, marginTop: 38 }}>
              <div style={{ display: "flex", flexGrow: 1, justifyContent: "center", alignItems: "center", border: `2px solid ${EDGE}`, backgroundColor: SURFACE2, borderRadius: 20, padding: "22px 0", fontSize: 26, fontWeight: 700, color: RED }}>NOPE</div>
              <div style={{ display: "flex", flexGrow: 1, justifyContent: "center", alignItems: "center", border: `2px solid ${EDGE}`, backgroundColor: SURFACE2, borderRadius: 20, padding: "22px 0", fontSize: 26, fontWeight: 700, color: GREEN }}>LIKE</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 8 }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: GOLD, display: "flex" }}>{LINK}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- charts */

function ChartCard({ title, week, rows, note, height }: { title: string; week: string; rows: { rank: number; main: string; sub?: string; art?: string | null }[]; note: string; height: number }) {
  return (
    <div style={{ width: 1080, height, display: "flex", flexDirection: "column", backgroundColor: BG, padding: 72, fontFamily: "Inter" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={230} height={120} alt="" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontFamily: "Anton", fontSize: 46, color: INK, letterSpacing: 1, display: "flex" }}>{title}</div>
          <div style={{ fontSize: 22, color: MUTED, marginTop: 4, display: "flex" }}>{week}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, marginTop: 34, gap: 12 }}>
        {rows.map((r) => (
          <div key={r.rank} style={{ display: "flex", alignItems: "center", backgroundColor: SURFACE, border: `2px solid ${EDGE}`, borderRadius: 22, padding: 16 }}>
            <div style={{ width: 62, display: "flex", justifyContent: "center", fontSize: 38, fontWeight: 700, color: r.rank <= 3 ? GOLD : MUTED }}>{r.rank}</div>
            {r.art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.art} width={72} height={72} alt="" style={{ borderRadius: 12, objectFit: "cover" }} />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 20, flexGrow: 1 }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: INK, display: "flex" }}>{r.main}</div>
              {r.sub ? <div style={{ fontSize: 24, color: MUTED, marginTop: 2, display: "flex" }}>{r.sub}</div> : null}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <div style={{ fontSize: 24, color: MUTED, display: "flex", maxWidth: 620 }}>{note}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: GOLD, display: "flex" }}>{LINK}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- main */

async function main() {
  void React;
  const [anton, inter4, inter6, inter7] = await Promise.all([
    googleFont("Anton", 400),
    googleFont("Inter", 400),
    googleFont("Inter", 600),
    googleFont("Inter", 700),
  ]);
  FONTS = [];
  if (anton) FONTS.push({ name: "Anton", data: anton, weight: 400, style: "normal" });
  if (inter4) FONTS.push({ name: "Inter", data: inter4, weight: 400, style: "normal" });
  if (inter6) FONTS.push({ name: "Inter", data: inter6, weight: 600, style: "normal" });
  if (inter7) FONTS.push({ name: "Inter", data: inter7, weight: 700, style: "normal" });

  console.log("Halloween stories");
  for (const c of halloween) await write(path.join(ROOT, "Halloween"), `motr-${c.file}.png`, <Story c={c} />, 1080, 1920);

  console.log("\nFeed squares");
  for (const c of squares) await write(path.join(ROOT, "Feed Squares"), `motr-${c.file}.png`, <Square c={c} />, 1080, 1080);

  console.log("\nCharts");
  const w = weekOf();
  const l = await leadersBetween(w.start, w.end);
  const art = await Promise.all(l.songs.slice(0, 10).map((s) => dataUri(s.artworkUrl)));

  await write(path.join(ROOT, "Charts"), "motr-chart-top-songs.png",
    <ChartCard title="TOP SONGS" week={w.label} height={1350} note="Ranked by how many listeners kept the song. Nothing can be bought."
      rows={l.songs.slice(0, 10).map((s, i) => ({ rank: i + 1, main: s.title, sub: s.artistName, art: art[i] }))} />, 1080, 1350);

  await write(path.join(ROOT, "Charts"), "motr-chart-top-artists.png",
    <ChartCard title="TOP ARTISTS" week={w.label} height={1350} note="Ranked by how many listeners kept their music this week."
      rows={l.artists.slice(0, 10).map((a, i) => ({ rank: i + 1, main: a.name, sub: `${a.tracks} track${a.tracks === 1 ? "" : "s"} in the feed` }))} />, 1080, 1350);

  await write(path.join(ROOT, "Charts"), "motr-chart-top-songs-5.png",
    <ChartCard title="TOP 5 SONGS" week={w.label} height={1080} note="Ranked by how many listeners kept the song."
      rows={l.songs.slice(0, 5).map((s, i) => ({ rank: i + 1, main: s.title, sub: s.artistName, art: art[i] }))} />, 1080, 1080);

  await write(path.join(ROOT, "Charts"), "motr-chart-top-artists-5.png",
    <ChartCard title="TOP 5 ARTISTS" week={w.label} height={1080} note="Ranked by how many listeners kept their music this week."
      rows={l.artists.slice(0, 5).map((a, i) => ({ rank: i + 1, main: a.name, sub: `${a.tracks} track${a.tracks === 1 ? "" : "s"} in the feed` }))} />, 1080, 1080);

  console.log("\ndone");
}
main();
