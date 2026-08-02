/**
 * Puts real, playable music in the discovery feed.
 *
 * The original seed used invented song titles, so nothing had artwork and
 * the audio was a placeholder MP3. These are real releases looked up through
 * the iTunes Search API, which gives us genuine 30-second previews and cover
 * art — the same path a live artist submission takes.
 *
 * Run: node scripts/seed-real-tracks.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { searchItunes } from "../lib/trackLookup.ts";

process.loadEnvFile(".env");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Spread across genres so curator routing has something to match on.
const WANTED: { query: string; genre: string }[] = [
  { query: "Khruangbin Texas Sun", genre: "Indie / Alternative" },
  { query: "Men I Trust Show Me How", genre: "Indie / Alternative" },
  { query: "Leon Bridges River", genre: "R&B / Soul" },
  { query: "Hiatus Kaiyote Red Room", genre: "R&B / Soul" },
  { query: "Little Dragon Twice", genre: "Electronic / Dance" },
  { query: "Bonobo Kerala", genre: "Electronic / Dance" },
  { query: "Fred again Delilah", genre: "House / Techno" },
  { query: "Sampha Blood On Me", genre: "Hip-Hop / Rap" },
  { query: "BADBADNOTGOOD Time Moves Slow", genre: "Jazz" },
  { query: "Big Thief Not", genre: "Folk / Acoustic" },
  { query: "Sault Wildfires", genre: "R&B / Soul" },
  { query: "Tame Impala Borderline", genre: "Rock" },
];

async function main() {
  // Take the invented test tracks out of the fan feed without deleting rows
  // that swipes and assignments still point at.
  const retired = await prisma.track.updateMany({
    where: { previewUrl: { contains: "filesamples.com" }, status: "DISCOVERY" },
    data: { status: "REJECTED" },
  });
  if (retired.count) console.log(`Retired ${retired.count} placeholder track(s).\n`);

  let added = 0;
  for (const { query, genre } of WANTED) {
    const found = await searchItunes(query);
    if (!found?.previewUrl) {
      console.log(`  ✗ ${query}: no preview available`);
      continue;
    }

    const externalId = `itunes-${found.trackName}-${found.artistName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 80);

    const existing = await prisma.track.findUnique({
      where: { source_externalId: { source: "SPOTIFY", externalId } },
    });
    if (existing) {
      console.log(`  · ${found.trackName} already present`);
      continue;
    }

    await prisma.track.create({
      data: {
        source: "SPOTIFY",
        externalId,
        title: found.trackName,
        artistName: found.artistName,
        albumName: found.collectionName ?? null,
        artworkUrl: (found.artworkUrl100 ?? "").replace(/\/\d+x\d+bb\./, "/600x600bb.") || null,
        previewUrl: found.previewUrl,
        durationMs: found.trackTimeMillis ?? null,
        genre,
        requiredFanApprovals: 3,
      },
    });
    added++;
    console.log(`  ✓ ${found.trackName} — ${found.artistName}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nAdded ${added} real track(s) to the feed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
