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

// Spread across every genre so the mood filter has something behind each
// chip and curator routing has real variety to match on.
const WANTED: { query: string; genre: string }[] = [
  { query: "Kendrick Lamar Money Trees", genre: "Hip-Hop / Rap" },
  { query: "JID Surround Sound", genre: "Hip-Hop / Rap" },
  { query: "Little Simz Introvert", genre: "Hip-Hop / Rap" },
  { query: "Denzel Curry Walkin", genre: "Hip-Hop / Rap" },
  { query: "Freddie Gibbs Crime Pays", genre: "Hip-Hop / Rap" },
  { query: "Danny Brown Ain't It Funny", genre: "Hip-Hop / Rap" },
  { query: "Isaiah Rashad Headshots", genre: "Hip-Hop / Rap" },
  { query: "Cleo Sol Sunshine", genre: "R&B / Soul" },
  { query: "Steve Lacy Bad Habit", genre: "R&B / Soul" },
  { query: "Snoh Aalegra I Want You Around", genre: "R&B / Soul" },
  { query: "Daniel Caesar Best Part", genre: "R&B / Soul" },
  { query: "Jorja Smith Blue Lights", genre: "R&B / Soul" },
  { query: "Solange Cranes in the Sky", genre: "R&B / Soul" },
  { query: "Michael Kiwanuka Cold Little Heart", genre: "R&B / Soul" },
  { query: "Hiatus Kaiyote Nakamarra", genre: "R&B / Soul" },
  { query: "Dua Lipa Levitating", genre: "Pop" },
  { query: "Harry Styles As It Was", genre: "Pop" },
  { query: "Lorde Solar Power", genre: "Pop" },
  { query: "Caroline Polachek Bunny Is A Rider", genre: "Pop" },
  { query: "Robyn Dancing On My Own", genre: "Pop" },
  { query: "Carly Rae Jepsen Run Away With Me", genre: "Pop" },
  { query: "Charli XCX Von Dutch", genre: "Pop" },
  { query: "Alvvays Archie Marry Me", genre: "Indie / Alternative" },
  { query: "Beach House Space Song", genre: "Indie / Alternative" },
  { query: "Japanese Breakfast Be Sweet", genre: "Indie / Alternative" },
  { query: "Wet Leg Chaise Longue", genre: "Indie / Alternative" },
  { query: "Phoenix 1901", genre: "Indie / Alternative" },
  { query: "Vampire Weekend Harmony Hall", genre: "Indie / Alternative" },
  { query: "Yeah Yeah Yeahs Maps", genre: "Indie / Alternative" },
  { query: "Men I Trust Numb", genre: "Indie / Alternative" },
  { query: "The Strokes Reptilia", genre: "Rock" },
  { query: "Arctic Monkeys Do I Wanna Know", genre: "Rock" },
  { query: "Queens of the Stone Age No One Knows", genre: "Rock" },
  { query: "The Black Keys Lonely Boy", genre: "Rock" },
  { query: "Radiohead 15 Step", genre: "Rock" },
  { query: "Foo Fighters Everlong", genre: "Rock" },
  { query: "Wolf Alice Bros", genre: "Rock" },
  { query: "Caribou Odessa", genre: "Electronic / Dance" },
  { query: "Jamie xx Gosh", genre: "Electronic / Dance" },
  { query: "Four Tet Baby", genre: "Electronic / Dance" },
  { query: "RUFUS DU SOL Innerbloom", genre: "Electronic / Dance" },
  { query: "Disclosure Latch", genre: "Electronic / Dance" },
  { query: "ODESZA Say My Name", genre: "Electronic / Dance" },
  { query: "Flume Never Be Like You", genre: "Electronic / Dance" },
  { query: "Peggy Gou It Makes You Forget", genre: "House / Techno" },
  { query: "Floating Points LesAlpx", genre: "House / Techno" },
  { query: "Bicep Glue", genre: "House / Techno" },
  { query: "Daft Punk Around The World", genre: "House / Techno" },
  { query: "Honey Dijon Not About You", genre: "House / Techno" },
  { query: "DJ Koze Pick Up", genre: "House / Techno" },
  { query: "Fisher Losing It", genre: "House / Techno" },
  { query: "Chris Stapleton Tennessee Whiskey", genre: "Country / Americana" },
  { query: "Kacey Musgraves Slow Burn", genre: "Country / Americana" },
  { query: "Sturgill Simpson Turtles All The Way Down", genre: "Country / Americana" },
  { query: "Jason Isbell Cover Me Up", genre: "Country / Americana" },
  { query: "Zach Bryan Something in the Orange", genre: "Country / Americana" },
  { query: "Tyler Childers Feathered Indians", genre: "Country / Americana" },
  { query: "Brandi Carlile The Joke", genre: "Country / Americana" },
  { query: "Kamasi Washington Street Fighter Mas", genre: "Jazz" },
  { query: "Robert Glasper Afro Blue", genre: "Jazz" },
  { query: "Esperanza Spalding I Know You Know", genre: "Jazz" },
  { query: "Nubya Garcia Source", genre: "Jazz" },
  { query: "Yussef Dayes Love Is The Message", genre: "Jazz" },
  { query: "Ezra Collective Victory Dance", genre: "Jazz" },
  { query: "Christian Scott West of the West", genre: "Jazz" },
  { query: "Bad Bunny Titi Me Pregunto", genre: "Latin" },
  { query: "Rosalia Despecha", genre: "Latin" },
  { query: "KAROL G Provenza", genre: "Latin" },
  { query: "J Balvin Mi Gente", genre: "Latin" },
  { query: "Rauw Alejandro Todo de Ti", genre: "Latin" },
  { query: "Buena Vista Social Club Chan Chan", genre: "Latin" },
  { query: "Natanael Cano Amor Tumbado", genre: "Latin" },
  { query: "Burna Boy Last Last", genre: "Afrobeats" },
  { query: "Wizkid Essence", genre: "Afrobeats" },
  { query: "Rema Calm Down", genre: "Afrobeats" },
  { query: "Tems Free Mind", genre: "Afrobeats" },
  { query: "Asake Sungba", genre: "Afrobeats" },
  { query: "Davido Unavailable", genre: "Afrobeats" },
  { query: "Fireboy DML Peru", genre: "Afrobeats" },
  { query: "Turnstile Holiday", genre: "Metal / Punk" },
  { query: "Gojira Amazonia", genre: "Metal / Punk" },
  { query: "Deftones My Own Summer", genre: "Metal / Punk" },
  { query: "Mastodon Blood and Thunder", genre: "Metal / Punk" },
  { query: "Refused New Noise", genre: "Metal / Punk" },
  { query: "Bad Brains Sailin On", genre: "Metal / Punk" },
  { query: "Knocked Loose Counting Worms", genre: "Metal / Punk" },
  { query: "Bon Iver Holocene", genre: "Folk / Acoustic" },
  { query: "Fleet Foxes White Winter Hymnal", genre: "Folk / Acoustic" },
  { query: "Sufjan Stevens Mystery of Love", genre: "Folk / Acoustic" },
  { query: "Nick Drake Pink Moon", genre: "Folk / Acoustic" },
  { query: "Jose Gonzalez Heartbeats", genre: "Folk / Acoustic" },
  { query: "Iron and Wine Naked As We Came", genre: "Folk / Acoustic" },
  { query: "The Tallest Man On Earth Love Is All", genre: "Folk / Acoustic" },
  { query: "Brian Eno An Ending Ascent", genre: "Ambient / Experimental" },
  { query: "Tim Hecker Virginal II", genre: "Ambient / Experimental" },
  { query: "Aphex Twin Xtal", genre: "Ambient / Experimental" },
  { query: "Boards of Canada Roygbiv", genre: "Ambient / Experimental" },
  { query: "Nils Frahm Says", genre: "Ambient / Experimental" },
  { query: "Olafur Arnalds Near Light", genre: "Ambient / Experimental" },
  { query: "Grouper Heavy Water", genre: "Ambient / Experimental" },
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
    // iTunes throttles aggressively at ~20 requests/minute and answers a
    // rate-limited call the same way it answers a genuine miss, so a bare
    // failure gets retried before we believe it.
    let found = await searchItunes(query);
    for (let attempt = 0; !found?.previewUrl && attempt < 3; attempt++) {
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
      found = await searchItunes(query);
    }
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
      },
    });
    added++;
    console.log(`  ✓ ${found.trackName} — ${found.artistName}`);
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log(`\nAdded ${added} real track(s) to the feed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
