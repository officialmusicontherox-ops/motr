import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { battleForCard } from "@/lib/battles";

/**
 * The image somebody posts when they share a battle.
 *
 *   /api/battles/card?b=<id>&format=story   1080 x 1920, for a story
 *   /api/battles/card?b=<id>&format=post    1080 x 1080, for a feed post
 *
 * While voting is open it names both songs and asks for votes, and carries
 * no score: a split printed on a post is out of date within the hour, and
 * a visible lead tells people who to vote for. Once the week has closed it
 * becomes the result, with the final split and the winner marked.
 */
export const runtime = "nodejs";

const PURPLE = "#b45cff";
const CYAN = "#38c6f4";
const GOLD = "#dcb55f";
const INK = "#09090a";

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

/** Inlined, because the renderer will not reliably reach out for images. */
async function inline(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("b");
  const story = req.nextUrl.searchParams.get("format") !== "post";
  const battle = id ? await battleForCard(id) : null;
  if (!battle) return new Response("Not found", { status: 404 });

  const origin = req.nextUrl.origin;
  const [font, logo, title, vs, artA, artB] = await Promise.all([
    anton(),
    inline(`${origin}/motr-logo.png`),
    inline(`${origin}/battles-title.png`),
    inline(`${origin}/battles-vs.png`),
    inline(battle.a.artworkUrl),
    inline(battle.b.artworkUrl),
  ]);
  const display = font ? "Anton" : "sans-serif";

  const W = 1080;
  const H = story ? 1920 : 1080;
  const art = story ? 430 : 350;
  const done = battle.closed;
  const showPct = done && battle.pct;

  const side = (s: typeof battle.a, img: string | null, color: string, glow: string, pct: number | null, won: boolean) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: art + 40 }}>
      {/* Three rings of tube, as on the screen itself. */}
      <div
        style={{
          display: "flex",
          padding: 7,
          borderRadius: 44,
          border: `5px solid ${color}`,
          boxShadow: `0 0 46px rgba(${glow}, 0.7)`,
          opacity: done && !won && battle.winner ? 0.55 : 1,
        }}
      >
        <div style={{ display: "flex", padding: 7, borderRadius: 34, border: `4px solid rgba(${glow}, 0.75)` }}>
          <div
            style={{
              display: "flex",
              width: art - 44,
              height: art - 44,
              borderRadius: 24,
              border: `4px solid rgba(${glow}, 0.55)`,
              overflow: "hidden",
              background: "#0c0c10",
            }}
          >
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" width={art - 52} height={art - 52} style={{ objectFit: "cover" }} />
            )}
          </div>
        </div>
      </div>

      {won && (
        <div
          style={{
            display: "flex",
            marginTop: 22,
            background: GOLD,
            color: INK,
            borderRadius: 999,
            padding: "6px 22px",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 4,
          }}
        >
          WINNER
        </div>
      )}
      <div
        style={{
          display: "flex",
          marginTop: won ? 14 : 26,
          fontFamily: display,
          fontSize: story ? 46 : 38,
          color: "#fff",
          textAlign: "center",
          lineHeight: 1.1,
          justifyContent: "center",
        }}
      >
        {clip(s.title, 22)}
      </div>
      <div style={{ display: "flex", marginTop: 8, fontSize: story ? 30 : 26, color: "#b9b9c0", justifyContent: "center" }}>
        {clip(s.artistName, 26)}
      </div>
      {pct !== null && (
        <div style={{ display: "flex", marginTop: 10, fontFamily: display, fontSize: story ? 84 : 64, color }}>
          {pct}%
        </div>
      )}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: story ? "110px 40px 120px" : "44px 40px 50px",
          background: INK,
          backgroundImage:
            "radial-gradient(circle at 12% 18%, rgba(255,45,155,0.20), transparent 42%), radial-gradient(circle at 88% 30%, rgba(58,168,255,0.20), transparent 42%), radial-gradient(circle at 50% 100%, rgba(168,85,247,0.18), transparent 50%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" height={story ? 150 : 96} width={story ? 273 : 175} />
          )}
          {title && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={title}
              alt=""
              width={story ? 760 : 520}
              height={story ? 225 : 154}
              style={{ marginTop: story ? 18 : 4 }}
            />
          )}
          <div
            style={{
              display: "flex",
              marginTop: story ? 26 : 8,
              fontSize: story ? 34 : 26,
              letterSpacing: 6,
              color: done ? GOLD : "#fff",
              fontWeight: 700,
            }}
          >
            {done ? "FINAL RESULT" : "TWO SONGS. HEAD TO HEAD. YOU DECIDE."}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", position: "relative", width: W - 80 }}>
          {side(battle.a, artA, PURPLE, "180, 92, 255", showPct ? battle.pct!.a : null, done && battle.winner === "A")}
          <div style={{ display: "flex", width: story ? 60 : 70 }} />
          {side(battle.b, artB, CYAN, "56, 198, 244", showPct ? battle.pct!.b : null, done && battle.winner === "B")}
          {vs && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vs}
              alt=""
              width={story ? 260 : 210}
              height={story ? 160 : 130}
              style={{ position: "absolute", left: (W - 80) / 2 - (story ? 130 : 105), top: art / 2 - (story ? 70 : 60) }}
            />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: story ? 36 : 28, color: "#e6e6ea", textAlign: "center" }}>
            {done ? `Week of ${battle.week}` : "Hear both and pick your winner."}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: story ? 30 : 16,
              border: `3px solid ${GOLD}`,
              color: GOLD,
              borderRadius: 999,
              padding: story ? "18px 44px" : "12px 34px",
              fontSize: story ? 38 : 30,
              fontWeight: 700,
            }}
          >
            app.musicontherox.com/battles
          </div>
          {!done && (
            <div style={{ display: "flex", marginTop: story ? 24 : 12, fontSize: story ? 28 : 22, color: "#8b8b93" }}>
              Voting closes Saturday at midnight Central
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: font ? [{ name: "Anton", data: font, style: "normal", weight: 400 }] : [],
      headers: {
        // Short while it is open, because the result will replace it.
        "cache-control": done ? "public, max-age=86400" : "public, max-age=300",
      },
    }
  );
}
