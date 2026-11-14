import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * What a brand-new listener actually hears first.
 *
 * Runs the real feed query for a fan with no swipes, many times, and counts
 * the genre of the first card. Read-only: it never writes a swipe, so every
 * draw is the true "first card" case.
 */
process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const DRAWS = 500;
const counts = new Map<string, number>();

for (let i = 0; i < DRAWS; i++) {
  const rows = await prisma.$queryRawUnsafe<Array<{ genre: string | null }>>(
    `SELECT t."genre"
       FROM "Track" t
      WHERE t."status" = 'DISCOVERY'
      ORDER BY RANDOM()
      LIMIT 1`
  );
  const g = rows[0]?.genre ?? "(none)";
  counts.set(g, (counts.get(g) ?? 0) + 1);
}

console.log(`  first card for a new listener, ${DRAWS} draws:\n`);
for (const [g, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${((n / DRAWS) * 100).toFixed(1).padStart(5)}%  ${g}`);
}

// And what the first six look like in sequence, a few times over, which is
// what somebody actually experiences on arrival.
console.log(`\n  sample openings:`);
for (let run = 0; run < 6; run++) {
  const rows = await prisma.$queryRawUnsafe<Array<{ genre: string | null }>>(
    `SELECT t."genre" FROM "Track" t WHERE t."status" = 'DISCOVERY' ORDER BY RANDOM() LIMIT 6`
  );
  console.log(`    ${rows.map((r) => (r.genre ?? "?").split(" /")[0]).join(" · ")}`);
}

await prisma.$disconnect();
