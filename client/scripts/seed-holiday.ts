/**
 * Seeds the Holiday genre, for the season only.
 *
 * Same shape as topup-tracks: look each one up on iTunes, store the preview,
 * leave artistId null so these never reach the charts or the weekly contest.
 * They are there to make the genre worth opening, not to compete with the
 * artists who submitted.
 *
 * Remove after Christmas:
 *   UPDATE "Track" SET status = 'REJECTED' WHERE genre = 'Holiday' AND "artistId" IS NULL;
 *
 * Run: DATABASE_URL="$NEON" npx tsx scripts/seed-holiday.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { searchItunes } from "../lib/trackLookup.ts";

process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const GENRE = "Holiday";

const WANTED = [
  "Mariah Carey All I Want for Christmas Is You",
  "Kelly Clarkson Underneath the Tree",
  "Wham Last Christmas",
  "Brenda Lee Rockin Around the Christmas Tree",
  "Bobby Helms Jingle Bell Rock",
  "Andy Williams Its the Most Wonderful Time of the Year",
  "Nat King Cole The Christmas Song",
  "Bing Crosby White Christmas",
  "Burl Ives A Holly Jolly Christmas",
  "Darlene Love Christmas Baby Please Come Home",
  "Ariana Grande Santa Tell Me",
  "Michael Buble Its Beginning to Look a Lot Like Christmas",
  "Dean Martin Let It Snow",
  "Eartha Kitt Santa Baby",
  "Band Aid Do They Know Its Christmas",
  "The Pogues Fairytale of New York",
  "Paul McCartney Wonderful Christmastime",
  "Jose Feliciano Feliz Navidad",
  "Sia Snowman",
  "Pentatonix Carol of the Bells",
  "Elvis Presley Blue Christmas",
  "Run DMC Christmas in Hollis",
];

async function main() {
  let added = 0;
  for (const query of WANTED) {
    // iTunes throttles hard and answers a rate-limited call exactly like a
    // real miss, so a failure is retried rather than written off.
    let found = await searchItunes(query);
    for (let a = 0; !found?.previewUrl && a < 4; a++) {
      await new Promise((r) => setTimeout(r, 8000));
      found = await searchItunes(query);
    }
    if (!found?.previewUrl) {
      console.log(`  x ${query}`);
      continue;
    }

    const externalId = `itunes-${found.trackName}-${found.artistName}`
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);

    if (await prisma.track.findUnique({
      where: { source_externalId: { source: "SPOTIFY", externalId } },
    })) {
      console.log(`  . ${found.trackName} already present`);
      continue;
    }

    await prisma.track.create({
      data: {
        source: "SPOTIFY", externalId,
        title: found.trackName, artistName: found.artistName,
        albumName: found.collectionName ?? null,
        artworkUrl: (found.artworkUrl100 ?? "").replace(/\/\d+x\d+bb\./, "/600x600bb.") || null,
        previewUrl: found.previewUrl,
        durationMs: found.trackTimeMillis ?? null,
        appleTrackId: found.trackId ? String(found.trackId) : null,
        appleArtistId: found.artistId ? String(found.artistId) : null,
        appleArtistName: found.artistName ?? null,
        genre: GENRE,
      },
    });
    added++;
    console.log(`  + ${found.trackName} - ${found.artistName}`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  console.log(`\n  seeded ${added} holiday track(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
