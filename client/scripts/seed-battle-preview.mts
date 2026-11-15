/**
 * Puts one real battle into the LOCAL database so the screen can be
 * photographed, and prints a session cookie for the listener it makes.
 *
 *   seed:    npx tsx scripts/seed-battle-preview.mts
 *   cleanup: npx tsx scripts/seed-battle-preview.mts --clean
 *
 * Reads two songs from production, read-only, so the reveal shows real
 * artwork and names. Writes only to localhost and refuses anything else.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
  console.error("  refusing to run: DATABASE_URL is not a local database");
  process.exit(1);
}

const STATE = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "/tmp/battle-preview.json";
const local = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

if (process.argv.includes("--clean")) {
  const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
  await local.battle.deleteMany({ where: { fanId: st.fan } });
  await local.track.deleteMany({ where: { id: { in: st.tracks } } });
  await local.artist.deleteMany({ where: { id: { in: st.artists } } });
  await local.fan.deleteMany({ where: { id: st.fan } });
  await local.track.updateMany({ where: { id: { in: st.parked } }, data: { status: "DISCOVERY" } });
  fs.unlinkSync(STATE);
  console.log("  cleaned up");
  await local.$disconnect();
  process.exit(0);
}

const prod = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});
const picks = await prod.$queryRawUnsafe<
  Array<{
    title: string; artistName: string; artworkUrl: string; previewUrl: string;
    externalId: string; appleArtistId: string | null; appleArtistName: string | null;
  }>
>(
  `SELECT DISTINCT ON (COALESCE(t."appleArtistId", t."artistName"))
          t."title", t."artistName", t."artworkUrl", t."previewUrl", t."externalId",
          t."appleArtistId", t."appleArtistName"
     FROM "Track" t
    WHERE t."status" = 'DISCOVERY' AND t."artistId" IS NOT NULL
      AND t."genre" = 'Rock' AND t."artworkUrl" IS NOT NULL
      AND (t."aiGenerated" IS NULL OR t."aiGenerated" = false)
    ORDER BY COALESCE(t."appleArtistId", t."artistName"), t."fanRightSwipes" DESC
    LIMIT 2`
);
await prod.$disconnect();

// Park anything already eligible locally, so the one battle served is this one.
const parked = await local.track.findMany({
  where: { status: "DISCOVERY", artistId: { not: null } },
  select: { id: true },
});
await local.track.updateMany({ where: { id: { in: parked.map((p) => p.id) } }, data: { status: "VETTING" } });

const id = () => crypto.randomBytes(4).toString("hex");
const artists: string[] = [];
const tracks: string[] = [];
for (const p of picks) {
  const a = await local.artist.create({ data: { name: p.artistName, email: `${id()}@example.invalid` } });
  artists.push(a.id);
  const t = await local.track.create({
    data: {
      source: "SPOTIFY",
      externalId: p.externalId + "-pv" + id(),
      title: p.title,
      artistName: p.artistName,
      artworkUrl: p.artworkUrl,
      previewUrl: p.previewUrl,
      artistId: a.id,
      genre: "Rock",
      appleArtistId: p.appleArtistId,
      appleArtistName: p.appleArtistName,
      // So the reveal shows a believable record rather than 1 and 0.
      battles: 9 + tracks.length * 4,
      battleWins: 6 + tracks.length * 1,
    },
  });
  tracks.push(t.id);
}

const fan = await local.fan.create({ data: { username: "preview-" + id() } });
fs.writeFileSync(STATE, JSON.stringify({ fan: fan.id, artists, tracks, parked: parked.map((p) => p.id) }));

const { fanSessionCookie } = await import("../lib/fanAuth.ts");
const c = fanSessionCookie(fan.id);
console.log(JSON.stringify({ name: c.name, value: c.value, fan: fan.id, songs: picks.map((p) => p.artistName) }));
await local.$disconnect();
