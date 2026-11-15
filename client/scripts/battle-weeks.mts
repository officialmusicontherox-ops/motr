import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
/** What battles exist in production, by week. Read-only. */
process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }) });
const rows = await prisma.$queryRawUnsafe<Array<{ weekStart: Date; n: bigint; votes: bigint; settled: bigint }>>(
  `SELECT "weekStart", COUNT(*) n, COALESCE(SUM("votesA"+"votesB"),0) votes, COUNT("settledAt") settled FROM "Battle" GROUP BY 1 ORDER BY 1`
);
if (!rows.length) console.log("  no battles paired yet");
for (const r of rows) console.log(`  week starting ${r.weekStart.toISOString()}: ${r.n} battles, ${r.votes} votes, ${r.settled} settled`);
console.log(`  votes rows: ${await prisma.battleVote.count()}`);
await prisma.$disconnect();
