/**
 * Fills in artwork and real 30-second previews for tracks that were created
 * before media lookup existed (seed rows and hand-made test data, which all
 * carried placeholder audio and no artwork).
 *
 * Run: node scripts/backfill-media.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveBySearch } from "../lib/trackLookup.ts";

process.loadEnvFile(".env");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tracks = await prisma.track.findMany({
    where: {
      OR: [{ artworkUrl: null }, { previewUrl: { contains: "filesamples.com" } }],
    },
  });

  console.log(`${tracks.length} track(s) need media.\n`);

  let fixed = 0;
  for (const t of tracks) {
    const resolved = await resolveBySearch(t.title, t.artistName);
    if (!resolved) {
      console.log(`  ✗ ${t.title} — ${t.artistName}: no match on Apple Music`);
      continue;
    }

    await prisma.track.update({
      where: { id: t.id },
      data: {
        artworkUrl: resolved.artworkUrl,
        previewUrl: resolved.previewUrl,
        albumName: resolved.albumName ?? t.albumName,
        durationMs: resolved.durationMs ?? t.durationMs,
      },
    });
    fixed++;
    console.log(`  ✓ ${t.title} — ${resolved.artistName} (${resolved.albumName ?? "single"})`);

    // Be polite to a free public API.
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nUpdated ${fixed} of ${tracks.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
