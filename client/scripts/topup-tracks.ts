/**
 * Fills in genres the main seed left thin.
 *
 * iTunes throttles hard and answers a rate-limited call exactly like a real
 * miss, so a fast bulk run silently loses whole genres off the end of the
 * list. This goes deliberately slowly and skips anything already present.
 *
 * Run: npx tsx scripts/topup-tracks.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { searchItunes } from "../lib/trackLookup.ts";

process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const WANTED: { query: string; genre: string }[] = [
  { query: "Burna Boy Last Last", genre: "Afrobeats" },
  { query: "Wizkid Essence Tems", genre: "Afrobeats" },
  { query: "Rema Calm Down", genre: "Afrobeats" },
  { query: "Tems Free Mind", genre: "Afrobeats" },
  { query: "Davido Unavailable", genre: "Afrobeats" },
  { query: "Fireboy DML Peru", genre: "Afrobeats" },
  { query: "CKay Love Nwantiti", genre: "Afrobeats" },
  { query: "Turnstile Holiday", genre: "Metal / Punk" },
  { query: "Deftones My Own Summer", genre: "Metal / Punk" },
  { query: "Mastodon Blood and Thunder", genre: "Metal / Punk" },
  { query: "Gojira Amazonia", genre: "Metal / Punk" },
  { query: "Refused New Noise", genre: "Metal / Punk" },
  { query: "Rage Against The Machine Bulls On Parade", genre: "Metal / Punk" },
  { query: "Bring Me The Horizon Throne", genre: "Metal / Punk" },
  { query: "Kamasi Washington Street Fighter Mas", genre: "Jazz" },
  { query: "Robert Glasper Afro Blue", genre: "Jazz" },
  { query: "Nubya Garcia Source", genre: "Jazz" },
  { query: "Ezra Collective Victory Dance", genre: "Jazz" },
  { query: "Esperanza Spalding I Know You Know", genre: "Jazz" },
  { query: "Bon Iver Holocene", genre: "Folk / Acoustic" },
  { query: "Fleet Foxes White Winter Hymnal", genre: "Folk / Acoustic" },
  { query: "Sufjan Stevens Mystery of Love", genre: "Folk / Acoustic" },
  { query: "Nick Drake Pink Moon", genre: "Folk / Acoustic" },
  { query: "Jose Gonzalez Heartbeats", genre: "Folk / Acoustic" },
  { query: "Bad Bunny Titi Me Pregunto", genre: "Latin" },
  { query: "KAROL G Provenza", genre: "Latin" },
  { query: "Rauw Alejandro Todo de Ti", genre: "Latin" },
  { query: "Buena Vista Social Club Chan Chan", genre: "Latin" },
  { query: "Rosalia Despecha", genre: "Latin" },
  { query: "Aphex Twin Xtal", genre: "Ambient / Experimental" },
  { query: "Boards of Canada Roygbiv", genre: "Ambient / Experimental" },
  { query: "Nils Frahm Says", genre: "Ambient / Experimental" },
  { query: "Olafur Arnalds Near Light", genre: "Ambient / Experimental" },
  { query: "Brian Eno By This River", genre: "Ambient / Experimental" },
  { query: "Jon Hopkins Emerald Rush", genre: "Ambient / Experimental" },
];

async function main() {
  let added = 0;
  for (const { query, genre } of WANTED) {
    let found = await searchItunes(query);
    for (let a = 0; !found?.previewUrl && a < 4; a++) {
      await new Promise((r) => setTimeout(r, 8000));
      found = await searchItunes(query);
    }
    if (!found?.previewUrl) {
      console.log(`  ✗ ${query}`);
      continue;
    }

    const externalId = `itunes-${found.trackName}-${found.artistName}`
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);

    if (await prisma.track.findUnique({
      where: { source_externalId: { source: "SPOTIFY", externalId } },
    })) {
      console.log(`  · ${found.trackName} already present`);
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
        genre,
      },
    });
    added++;
    console.log(`  ✓ ${found.trackName} — ${found.artistName} [${genre}]`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  console.log(`\nTopped up ${added} track(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
