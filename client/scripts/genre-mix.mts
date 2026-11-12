import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** What the blind feed is actually made of, by genre. Read-only. */
process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const rows = await prisma.$queryRawUnsafe<Array<{ genre: string | null; n: bigint; seeded: bigint }>>(
  `SELECT t."genre" AS genre,
          COUNT(*) AS n,
          COUNT(*) FILTER (WHERE t."artistId" IS NULL) AS seeded
     FROM "Track" t
    WHERE t."status" = 'DISCOVERY'
    GROUP BY t."genre"
    ORDER BY COUNT(*) DESC`
);

const total = rows.reduce((a, r) => a + Number(r.n), 0);
console.log(`  ${total} tracks in the blind feed\n`);
for (const r of rows) {
  const n = Number(r.n);
  const pct = ((n / total) * 100).toFixed(1).padStart(5);
  console.log(
    `  ${pct}%  ${String(n).padStart(3)}  ${(r.genre ?? "(none)").padEnd(24)} seeded: ${r.seeded}`
  );
}

await prisma.$disconnect();
