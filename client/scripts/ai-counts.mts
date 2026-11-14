import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});
const yes = await prisma.track.count({ where: { aiGenerated: true } });
const no = await prisma.track.count({ where: { aiGenerated: false } });
const unasked = await prisma.track.count({ where: { aiGenerated: null } });
console.log(`  declared AI: ${yes}   declared not: ${no}   never asked: ${unasked}`);
const rows = await prisma.track.findMany({
  where: { aiGenerated: true },
  select: { title: true, artistName: true, createdAt: true },
  orderBy: { createdAt: "desc" },
  take: 15,
});
for (const t of rows) {
  console.log(`    ${t.createdAt.toISOString().slice(0, 10)}  ${t.artistName.slice(0, 24).padEnd(26)} ${t.title.slice(0, 30)}`);
}
await prisma.$disconnect();
