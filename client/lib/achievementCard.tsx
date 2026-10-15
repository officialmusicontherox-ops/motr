import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { anton } from "./shareCard";
import type { EarnedBadge, FanStats } from "./achievements";

/**
 * The image a listener posts about what they have earned.
 *
 * Deliberately carries no name, no email and no listening history, only
 * totals: the URL has a fan id in it and a posted image travels further than
 * anyone intends, so there is nothing on here that identifies the person who
 * earned it.
 *
 * Built with the same renderer, palette and code placement as the artist
 * card, so the two read as the same product rather than as two designs that
 * happen to share a logo.
 */

export const ACHIEVEMENT_CARD_VERSION = "1";

const INK = "#09090a";
const GOLD = "#dcb55f";
const EDGE = "#262625";
const MUTED = "#8b8b8b";

export async function renderAchievementCard(params: {
  stats: FanStats;
  badges: EarnedBadge[];
}) {
  const { stats } = params;
  const earned = params.badges.filter((b) => b.earned);
  const link = "app.musicontherox.com";

  const [qr, font] = await Promise.all([
    QRCode.toDataURL(`https://${link}`, {
      margin: 0,
      width: 240,
      color: { dark: INK, light: "#ffffff" },
    }),
    anton(),
  ]);
  const display = font ? "Anton" : "sans-serif";

  // The three hardest ones earned, so the card leads with the best of it
  // rather than with whatever happened to come first.
  const headline = [...earned].sort((a, b) => b.need - a.need).slice(0, 3);

  const facts = [
    [stats.saves, stats.saves === 1 ? "track kept" : "tracks kept"],
    [stats.fullListens, stats.fullListens === 1 ? "full listen" : "full listens"],
    [stats.firstFinds, stats.firstFinds === 1 ? "found first" : "found first"],
  ] as const;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          display: "flex",
          flexDirection: "column",
          backgroundColor: INK,
          padding: 64,
          fontFamily: display,
        }}
      >
        <div style={{ display: "flex", color: GOLD, fontSize: 30, letterSpacing: 8 }}>
          MUSIC ON THE ROX
        </div>

        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
            <span style={{ color: "#ffffff", fontSize: 230, lineHeight: 1 }}>{earned.length}</span>
            <span style={{ color: MUTED, fontSize: 44, paddingBottom: 30 }}>
              {earned.length === 1 ? "BADGE EARNED" : "BADGES EARNED"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 36 }}>
            {headline.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span style={{ display: "flex", width: 14, height: 14, borderRadius: 7, backgroundColor: GOLD }} />
                <span style={{ color: "#ffffff", fontSize: 46 }}>{b.name.toUpperCase()}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 56, marginTop: 56 }}>
            {facts.map(([n, label]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: GOLD, fontSize: 64 }}>{n}</span>
                <span style={{ color: MUTED, fontSize: 24, letterSpacing: 2 }}>
                  {String(label).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", borderTop: `2px solid ${EDGE}`, paddingTop: 36, alignItems: "center", gap: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={168} height={168} alt="" style={{ borderRadius: 12, backgroundColor: "#fff", padding: 10 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#ffffff", fontSize: 40 }}>Find new artists. Thirty seconds at a time.</span>
            <span style={{ color: GOLD, fontSize: 36, marginTop: 10 }}>{link}</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: font ? [{ name: "Anton", data: font, style: "normal", weight: 400 }] : [],
    }
  );
}
