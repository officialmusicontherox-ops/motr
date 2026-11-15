/**
 * Brings an artist down to the cap, preserving the time already paid for.
 *
 *   dry run: npx tsx scripts/trim-to-cap.mts "DJ Rittenhouse"
 *   apply:   npx tsx scripts/trim-to-cap.mts "DJ Rittenhouse" --apply
 *
 * The oldest places keep running, because they were up first and expire
 * soonest. The rest go back in the queue carrying exactly what was left on
 * them, so no time is taken away and none is added. They start again when
 * one of that artist's own places ends.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PER_ARTIST } from "../lib/spotlightBundles.ts";

process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const name = process.argv[2];
const apply = process.argv.includes("--apply");
if (!name) {
  console.error("  usage: trim-to-cap.mts \"<artist name>\" [--apply]");
  process.exit(1);
}

const now = new Date();
const live = await prisma.spotlight.findMany({
  where: {
    artist: { name },
    startsAt: { lte: now, not: null },
    endsAt: { gt: now },
  },
  orderBy: { startsAt: "asc" },
  select: { id: true, startsAt: true, endsAt: true },
});

console.log(`  ${name}: ${live.length} live, cap is ${PER_ARTIST}\n`);
if (live.length <= PER_ARTIST) {
  console.log("  nothing to do");
  await prisma.$disconnect();
  process.exit(0);
}

const keep = live.slice(0, PER_ARTIST);
const move = live.slice(PER_ARTIST);

for (const k of keep) {
  const h = (k.endsAt!.getTime() - now.getTime()) / 3_600_000;
  console.log(`  KEEP   ${k.id}  ${h.toFixed(1)}h left, runs to ${k.endsAt!.toISOString()}`);
}
for (const m of move) {
  const left = m.endsAt!.getTime() - now.getTime();
  console.log(`  QUEUE  ${m.id}  ${(left / 3_600_000).toFixed(1)}h carried over`);
}

if (!apply) {
  console.log("\n  dry run. pass --apply to make the change");
  await prisma.$disconnect();
  process.exit(0);
}

for (const m of move) {
  const left = Math.max(0, m.endsAt!.getTime() - now.getTime());
  await prisma.spotlight.update({
    where: { id: m.id },
    data: { startsAt: null, endsAt: null, remainingMs: left },
  });
}
console.log(`\n  moved ${move.length} back to the queue`);

await prisma.$disconnect();
