/**
 * Brings every artist down to the Spotlight cap, keeping the time paid for.
 *
 *   dry run: npx tsx scripts/trim-all-to-cap.mts
 *   apply:   npx tsx scripts/trim-all-to-cap.mts --apply
 *
 * Each artist's oldest live place keeps running. The rest go back in the
 * queue carrying exactly what was left on them, no time taken and none
 * added, and start again when that artist's own place ends.
 *
 * Run only once the cap it trims to is the one the live site enforces, or
 * the site puts them straight back up.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PER_ARTIST } from "../lib/spotlightBundles.ts";

process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});
const apply = process.argv.includes("--apply");
const now = new Date();

const live = await prisma.spotlight.findMany({
  where: { startsAt: { lte: now, not: null }, endsAt: { gt: now } },
  orderBy: { startsAt: "asc" },
  select: { id: true, artistId: true, endsAt: true, artist: { select: { name: true } } },
});

const seen = new Map<string, number>();
const move: typeof live = [];
for (const s of live) {
  const n = seen.get(s.artistId) ?? 0;
  seen.set(s.artistId, n + 1);
  const h = ((s.endsAt!.getTime() - now.getTime()) / 3_600_000).toFixed(1);
  if (n < PER_ARTIST) console.log(`  KEEP   ${s.artist.name}  ${h}h left`);
  else {
    move.push(s);
    console.log(`  QUEUE  ${s.artist.name}  ${h}h carried over`);
  }
}
console.log(`\n  cap ${PER_ARTIST}: ${live.length} live, ${move.length} to move`);

if (apply) {
  for (const m of move) {
    await prisma.spotlight.update({
      where: { id: m.id },
      data: { startsAt: null, endsAt: null, remainingMs: Math.max(0, m.endsAt!.getTime() - now.getTime()) },
    });
  }
  console.log(`  moved ${move.length} back to the queue`);
} else console.log("  dry run. pass --apply to make the change");
await prisma.$disconnect();
