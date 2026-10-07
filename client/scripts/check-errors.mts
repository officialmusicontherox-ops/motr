import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const rows = await prisma.errorLog.findMany({
  orderBy: { lastSeen: "desc" },
  take: 5,
  select: { source: true, message: true, path: true, method: true, count: true,
            firstSeen: true, lastSeen: true, resolved: true, userAgent: true, stack: true },
});
console.log(`errors on record: ${rows.length}\n`);
for (const r of rows) {
  console.log("=".repeat(70));
  console.log(`${r.source}  x${r.count}  ${r.method ?? ""} ${r.path ?? ""}  resolved=${r.resolved}`);
  console.log(`first ${r.firstSeen.toISOString()}   last ${r.lastSeen.toISOString()}`);
  console.log(`agent: ${(r.userAgent ?? "none").slice(0, 100)}`);
  console.log(`\nMESSAGE:\n${r.message}`);
  if (r.stack) console.log(`\nSTACK (first 900):\n${r.stack.slice(0, 900)}`);
}
