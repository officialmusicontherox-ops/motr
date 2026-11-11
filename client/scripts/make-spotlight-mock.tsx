import React from "react";
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/**
 * Mockups of the Spotlight grid at real device sizes, so the tile size can
 * be judged before it ships. Pulls the live tiles and their real artwork.
 */

const OUT = process.argv[2] ?? ".";
const BG = "#09090a";
const SURFACE = "#121214";
const SURFACE2 = "#1c1c20";
const EDGE = "#2a2a30";
const INK = "#f4f4f5";
const MUTED = "#8b8b8b";
const GOLD = "#dcb55f";
const HOT = "#1db954";

const logo =
  "data:image/png;base64," +
  fs.readFileSync(path.join(process.cwd(), "public/motr-logo.png")).toString("base64");

async function anton(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Anton", {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 6.1; WOW64)" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

type Tile = {
  artistId: string;
  name: string;
  genre: string | null;
  image: string | null;
  monthlyListeners: number | null;
  spotifyUrl: string | null;
  appleUrl: string | null;
  paid: boolean;
};

function listeners(n: number) {
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const TABS = ["Discover", "Saved", "Charts", "Spotlight", "Menu"];

function card(t: Tile, s: number, paid: boolean) {
  const meta =
    (t.genre?.split(" /")[0] ?? "Music") +
    (t.monthlyListeners !== null ? ` · ${listeners(t.monthlyListeners)} listeners` : "");
  return (
    <div
      key={t.artistId}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        borderRadius: 16 * s,
        border: `${Math.max(1, s)}px solid ${EDGE}`,
        background: SURFACE,
      }}
    >
      <div style={{ display: "flex", flex: 1, minHeight: 0, background: SURFACE2 }}>
        {t.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: `${8 * s}px ${10 * s}px` }}>
        {paid && (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginBottom: 4 * s,
              background: GOLD,
              color: BG,
              borderRadius: 999,
              padding: `${1 * s}px ${7 * s}px`,
              fontSize: 9 * s,
              fontWeight: 700,
              letterSpacing: 1 * s,
            }}
          >
            SPOTLIGHT
          </div>
        )}
        <div style={{ color: INK, fontSize: 13 * s, fontWeight: 600 }}>
          {t.name.length > 20 ? t.name.slice(0, 19) + "…" : t.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 2 * s }}>
          <div style={{ color: MUTED, fontSize: 11 * s, flex: 1 }}>
            {meta.length > 26 ? meta.slice(0, 25) + "…" : meta}
          </div>
          <div
            style={{
              display: "flex",
              width: 7 * s,
              height: 7 * s,
              borderRadius: 999,
              background: HOT,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function screen(tiles: Tile[], s: number, desktop: boolean, display: string) {
  const cols = desktop ? 3 : 2;
  const gap = (desktop ? 16 : 10) * s;
  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += cols) rows.push(tiles.slice(i, i + cols));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: BG,
        fontFamily: "sans-serif",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 12 * s,
          paddingBottom: 6 * s,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" style={{ height: (desktop ? 80 : 56) * s, objectFit: "contain" }} />
        {desktop && (
          <div
            style={{
              display: "flex",
              marginTop: 12,
              paddingTop: 8,
              borderTop: `1px solid ${EDGE}`,
              width: 640,
              justifyContent: "center",
            }}
          >
            {TABS.map((l) => (
              <div
                key={l}
                style={{
                  display: "flex",
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: l === "Spotlight" ? SURFACE2 : "transparent",
                  color: l === "Spotlight" ? GOLD : MUTED,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.6,
                }}
              >
                {l.toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* main */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          paddingLeft: 20 * s,
          paddingRight: 20 * s,
          paddingTop: 8 * s,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            color: INK,
            fontFamily: display,
            fontSize: (desktop ? 24 : 20) * s,
            letterSpacing: 1 * s,
          }}
        >
          SPOTLIGHT
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            color: MUTED,
            fontSize: (desktop ? 14 : 12) * s,
            marginTop: 4 * s,
          }}
        >
          Artists someone wanted you to hear. Tap one to listen.
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            gap,
            marginTop: 12 * s,
            ...(desktop ? { maxWidth: 768 } : {}),
            width: "100%",
            alignSelf: "center",
          }}
        >
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", flex: 1, minHeight: 0, gap }}>
              {r.map((t, j) => card(t, s, i === 0 && j === 0))}
            </div>
          ))}
        </div>
      </div>

      {/* bottom bar */}
      {desktop ? (
        <div style={{ display: "flex", height: 16 }} />
      ) : (
        <div
          style={{
            display: "flex",
            borderTop: `${Math.max(1, s)}px solid ${EDGE}`,
            marginTop: 8 * s,
          }}
        >
          {TABS.map((l) => (
            <div
              key={l}
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 10 * s,
                paddingBottom: 12 * s,
                color: l === "Spotlight" ? GOLD : MUTED,
                fontSize: 8 * s,
                fontWeight: 700,
                letterSpacing: 1 * s,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 15 * s,
                  height: 15 * s,
                  borderRadius: 4 * s,
                  border: `${Math.max(1, s)}px solid currentColor`,
                  marginBottom: 5 * s,
                }}
              />
              {l.toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function main() {
  void React;
  const font = await anton();
  const display = font ? "Anton" : "sans-serif";

  const res = await fetch("https://app.musicontherox.com/api/spotlight");
  const tiles: Tile[] = (await res.json()).tiles;
  console.log(`  ${tiles.length} live tiles`);

  // Inline the artwork: satori will not reach out for it reliably.
  for (const t of tiles) {
    if (!t.image) continue;
    try {
      const b = Buffer.from(await (await fetch(t.image)).arrayBuffer());
      t.image = `data:image/jpeg;base64,${b.toString("base64")}`;
    } catch {
      t.image = null;
    }
  }

  fs.mkdirSync(OUT, { recursive: true });

  const shots: [string, number, number, number, boolean][] = [
    // Chrome on a phone, where the URL bar eats into the height.
    ["phone", 390, 760, 2, false],
    ["laptop", 1280, 800, 1, true],
  ];

  for (const [name, w, h, s, desktop] of shots) {
    const img = new ImageResponse(screen(tiles, s, desktop, display), {
      width: w * s,
      height: h * s,
      fonts: font ? [{ name: "Anton", data: font, style: "normal", weight: 400 }] : [],
    });
    const buf = Buffer.from(await img.arrayBuffer());
    const file = path.join(OUT, `spotlight-grid-${name}.png`);
    fs.writeFileSync(file, buf);
    console.log(`  ${path.basename(file)}  ${w}x${h}  ${Math.round(buf.length / 1024)}KB`);
  }
}
main();
