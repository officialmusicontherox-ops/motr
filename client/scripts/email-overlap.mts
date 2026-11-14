import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Why the recipient count is lower than the listener count on the dashboard. */
process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const fansAll = await prisma.fan.count({ where: { email: { not: null } } });
const fansOk = await prisma.fan.count({ where: { email: { not: null }, emailOptOut: false } });
const artistsOk = await prisma.artist.findMany({
  where: { emailOptOut: false, email: { not: "" } },
  select: { email: true },
});
const fans = await prisma.fan.findMany({
  where: { email: { not: null }, emailOptOut: false },
  select: { email: true },
});

const artistSet = new Set(artistsOk.map((a) => a.email.trim().toLowerCase()));
const fanEmails = fans.map((f) => (f.email ?? "").trim().toLowerCase()).filter(Boolean);
const overlap = fanEmails.filter((e) => artistSet.has(e));
const listenerOnly = new Set(fanEmails.filter((e) => !artistSet.has(e)));

console.log(`  listeners with an email, including opted out : ${fansAll}`);
console.log(`  minus listeners who opted out                : ${fansOk}`);
console.log(`  of those, same address as an artist account  : ${overlap.length}`);
console.log(`  listener-only addresses left                 : ${listenerOnly.size}`);
console.log(`  artists not opted out                        : ${artistSet.size}`);
console.log(`  total unique inboxes                         : ${artistSet.size + listenerOnly.size}`);

await prisma.$disconnect();
