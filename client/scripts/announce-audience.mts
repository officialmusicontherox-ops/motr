/** Who would receive an announcement. Read-only. */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const fans = await prisma.fan.findMany({
  where: { email: { not: null }, emailOptOut: false },
  select: { email: true, username: true, createdAt: true },
});
const optedOut = await prisma.fan.count({ where: { email: { not: null }, emailOptOut: true } });
const anonymous = await prisma.fan.count({ where: { email: null } });
const artists = await prisma.artist.count({ where: { emailOptOut: false } });

console.log(`signed-in listeners reachable : ${fans.length}`);
console.log(`  opted out                   : ${optedOut}`);
console.log(`anonymous (no address at all)  : ${anonymous}`);
console.log(`artists reachable              : ${artists}`);
