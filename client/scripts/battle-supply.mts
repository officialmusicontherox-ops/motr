import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
/** How many battles a week would hold right now. Read-only. */
process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }) });
const rows = await prisma.$queryRawUnsafe<Array<{ genre: string; ai: boolean; artists: bigint }>>(`
  WITH one AS (
    SELECT DISTINCT ON (COALESCE(t."appleArtistId", 'name:' || t."artistName"))
           t."genre", COALESCE(t."aiGenerated", false) AS ai
    FROM "Track" t
    WHERE t."status" = 'DISCOVERY' AND t."artistId" IS NOT NULL AND t."genre" IS NOT NULL
    ORDER BY COALESCE(t."appleArtistId", 'name:' || t."artistName"), t."createdAt" DESC
  )
  SELECT genre, ai, COUNT(*) AS artists FROM one GROUP BY 1, 2 ORDER BY 3 DESC`);
let battles = 0, artists = 0, out = 0;
for (const r of rows) { const n = Number(r.artists); artists += n; battles += Math.floor(n / 2); out += n % 2; }
console.log(`  artists eligible: ${artists}`);
console.log(`  battles this week at one per artist: ${battles}`);
console.log(`  artists sitting out (odd one in a group): ${out}`);
console.log(`  groups: ${rows.length}`);
await prisma.$disconnect();
