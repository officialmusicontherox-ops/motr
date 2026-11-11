import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * What the Spotlight feature has actually done in production.
 *
 * Purchases, who is holding credits, which slots are filled, and anything
 * that has thrown. Read-only.
 */
process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const buys = await prisma.spotlightPurchase.findMany({
  orderBy: { createdAt: "desc" },
  take: 10,
});
console.log(`  purchases: ${buys.length}`);
for (const b of buys) {
  console.log(
    `    ${b.createdAt.toISOString()}  ${b.credits} credits  $${(b.cents / 100).toFixed(2)}  ${b.sessionId}`
  );
}

const held = await prisma.fan.findMany({
  where: { spotlightCredits: { gt: 0 } },
  select: { username: true, spotlightCredits: true },
});
console.log(`  fans holding credits: ${held.length}`);
for (const f of held) console.log(`    ${f.username}  ${f.spotlightCredits}`);

const spots = await prisma.spotlight.findMany({
  orderBy: { createdAt: "desc" },
  take: 10,
  include: { artist: { select: { name: true } } },
});
console.log(`  spotlight rows: ${spots.length}`);
for (const s of spots) {
  console.log(`    ${s.createdAt.toISOString()}  ${s.artist.name}  fan=${s.fanId ?? "none"}`);
}

const errs = await prisma.errorLog.findMany({ orderBy: { lastSeen: "desc" }, take: 6 });
console.log(`  recent errors:`);
for (const e of errs) {
  console.log(
    `    ${e.lastSeen.toISOString()}  x${e.count}  ${e.path ?? ""}  ${(e.message ?? "").slice(0, 110)}`
  );
}

await prisma.$disconnect();
