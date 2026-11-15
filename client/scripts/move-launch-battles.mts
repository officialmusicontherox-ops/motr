/**
 * One-off for launch night, 14 Nov 2026: moves the battles paired that
 * evening into the first full week, so they close on Saturday 21 November
 * instead of hours after they opened.
 *
 *   move:   npx tsx scripts/move-launch-battles.mts
 *   strays: npx tsx scripts/move-launch-battles.mts --strays
 *
 * --strays removes any battle the old code paired for the closing week in
 * the minutes between the move and the new code going live. Only ones with
 * no votes are removed; any with votes are listed and left alone.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { weekOf } from "../lib/weekWindow.ts";

process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }) });

const first = weekOf(new Date("2026-11-16T00:00:00Z")).start;
const before = { weekStart: { lt: first } };

if (process.argv.includes("--strays")) {
  const voted = await prisma.battle.findMany({
    where: { ...before, OR: [{ votesA: { gt: 0 } }, { votesB: { gt: 0 } }] },
    select: { id: true, votesA: true, votesB: true },
  });
  const gone = await prisma.battle.deleteMany({ where: { ...before, votesA: 0, votesB: 0 } });
  console.log(`  removed ${gone.count} stray battle(s) with no votes`);
  for (const v of voted) console.log(`  LEFT ALONE, has votes: ${v.id} ${v.votesA}-${v.votesB}`);
} else {
  const moved = await prisma.battle.updateMany({
    where: { ...before, settledAt: null },
    data: { weekStart: first },
  });
  console.log(`  moved ${moved.count} battle(s) to the week starting ${first.toISOString()}`);
}
await prisma.$disconnect();
