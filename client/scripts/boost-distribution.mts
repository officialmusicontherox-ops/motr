import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * What the every-sixth-card boost actually picks, over many draws.
 *
 * Runs the real query against production data, read-only, for a listener
 * who has swiped nothing. Shows which artists win slots and how old the
 * winning tracks are, which is the only way to tell whether the weighting
 * does what the comment claims.
 */
process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const HALF = 14;
const WINDOW_DAYS = 30;
const DRAWS = 600;

const pool = await prisma.$queryRawUnsafe<Array<{ id: string; artistName: string; days: number }>>(
  `SELECT DISTINCT ON (t."artistId") t."id", t."artistName",
          EXTRACT(EPOCH FROM (NOW() - t."createdAt")) / 86400.0 AS days
     FROM "Track" t
    WHERE t."status" = 'DISCOVERY'
      AND t."artistId" IS NOT NULL
      AND t."createdAt" > NOW() - MAKE_INTERVAL(days => ${WINDOW_DAYS})
    ORDER BY t."artistId", t."createdAt" DESC`
);
console.log(`  candidate pool: ${pool.length} tracks, one per artist, inside ${WINDOW_DAYS} days\n`);

const wins = new Map<string, number>();
let ageSum = 0;

for (let i = 0; i < DRAWS; i++) {
  const row = await prisma.$queryRawUnsafe<Array<{ id: string; artistName: string; days: number }>>(
    `WITH candidates AS (
       SELECT DISTINCT ON (t."artistId") t."id", t."artistName", t."createdAt"
         FROM "Track" t
        WHERE t."status" = 'DISCOVERY'
          AND t."artistId" IS NOT NULL
          AND t."createdAt" > NOW() - MAKE_INTERVAL(days => ${WINDOW_DAYS})
        ORDER BY t."artistId", t."createdAt" DESC
     )
     SELECT "id", "artistName",
            EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 86400.0 AS days
       FROM candidates
      ORDER BY (-LN(GREATEST(RANDOM(), 1e-9)))
             * EXP(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 86400.0 / ${HALF}) ASC
      LIMIT 1`
  );
  if (!row.length) continue;
  wins.set(row[0].artistName, (wins.get(row[0].artistName) ?? 0) + 1);
  ageSum += Number(row[0].days);
}

const ranked = [...wins.entries()].sort((a, b) => b[1] - a[1]);
console.log(`  ${DRAWS} draws, ${ranked.length} different artists won a slot`);
console.log(`  average age of the winning track: ${(ageSum / DRAWS).toFixed(1)} days\n`);
console.log("  top artists by share:");
for (const [name, n] of ranked.slice(0, 10)) {
  const pct = ((n / DRAWS) * 100).toFixed(1).padStart(5);
  console.log(`    ${pct}%  ${name.slice(0, 30)}`);
}
const oldest = pool.slice().sort((a, b) => Number(b.days) - Number(a.days))[0];
if (oldest) {
  console.log(
    `\n  oldest in pool: ${Number(oldest.days).toFixed(1)} days (${oldest.artistName.slice(0, 26)}) — won ${wins.get(oldest.artistName) ?? 0} of ${DRAWS}`
  );
}

await prisma.$disconnect();
