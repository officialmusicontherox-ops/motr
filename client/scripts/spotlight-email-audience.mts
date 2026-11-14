import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Who the Spotlight announcement would reach, and what we can honestly claim. */
process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const artists = await prisma.artist.count({
  where: { emailOptOut: false, email: { not: "" } },
});
const artistsLive = await prisma.artist.count({
  where: { emailOptOut: false, tracks: { some: { status: { not: "REJECTED" } } } },
});
const fansWithEmail = await prisma.fan.count({
  where: { emailOptOut: false, email: { not: null } },
});
const fansAll = await prisma.fan.count();
const swipers = await prisma.fanSwipe
  .groupBy({ by: ["fanId"] })
  .then((r) => r.length);

const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const swipers30 = await prisma.fanSwipe
  .groupBy({ by: ["fanId"], where: { createdAt: { gte: since } } })
  .then((r) => r.length);

const swipes = await prisma.fanSwipe.count();
const tracks = await prisma.track.count({ where: { status: "DISCOVERY" } });

console.log(`  RECIPIENTS`);
console.log(`    artists with email, not opted out : ${artists}`);
console.log(`    listeners with email, not opted out: ${fansWithEmail}`);
console.log(`    total                              : ${artists + fansWithEmail}`);
console.log(`\n  WHAT IS TRUE ABOUT THE AUDIENCE`);
console.log(`    listener accounts, all time        : ${fansAll}`);
console.log(`    listeners who have ever swiped     : ${swipers}`);
console.log(`    listeners who swiped in 30 days    : ${swipers30}`);
console.log(`    verdicts cast, all time            : ${swipes}`);
console.log(`    artists with music in rotation     : ${artistsLive}`);
console.log(`    tracks in the blind feed           : ${tracks}`);

await prisma.$disconnect();
