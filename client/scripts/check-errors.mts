import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const rows = await prisma.errorLog.findMany({
  where: { lastSeen: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
  orderBy: { lastSeen: "desc" },
  take: 12,
  select: { source: true, message: true, path: true, method: true, count: true, lastSeen: true, resolved: true },
});
console.log(`errors in the last 48h: ${rows.length}\n`);
for (const r of rows) {
  console.log(`${r.lastSeen.toISOString()}  x${r.count}  ${r.source}  ${r.method ?? ""} ${r.path ?? ""}`);
  console.log(`   ${r.message.slice(0, 220)}\n`);
}
