/**
 * Fills the cached profile on every artist: photo, monthly listeners, and
 * the links out to Spotify and Apple.
 *
 * Paced deliberately. Each artist costs two page reads from Spotify plus one
 * Apple lookup, and doing that quickly across a few hundred artists is how
 * you get rate-limited into silence.
 *
 *   DATABASE_URL="$NEON" npx tsx scripts/refresh-artist-profiles.ts [--stale-days N]
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchProfile } from "../lib/artistProfile.ts";

process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const args = process.argv.slice(2);
const staleDays = args.includes("--stale-days")
  ? Number(args[args.indexOf("--stale-days") + 1])
  : 30;

async function main() {
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  const artists = await prisma.artist.findMany({
    where: {
      tracks: { some: { status: { not: "REJECTED" } } },
      OR: [{ profileFetchedAt: null }, { profileFetchedAt: { lt: cutoff } }],
    },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`  ${artists.length} artist(s) to refresh`);
  let photos = 0;
  let counts = 0;

  for (const a of artists) {
    const p = await fetchProfile(a.id);
    await prisma.artist.update({
      where: { id: a.id },
      data: { ...p, profileFetchedAt: new Date() },
    });
    if (p.photoUrl) photos++;
    if (p.monthlyListeners !== null) counts++;
    console.log(
      `  ${a.name.slice(0, 28).padEnd(30)} ${p.monthlyListeners ?? "?"} listeners  ${p.photoUrl ? "photo" : "no photo"}`
    );
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log(`\n  done: ${photos} with a photo, ${counts} with a listener count`);
}

main().catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
