import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
/** The newest entries in the live error log. Read-only. */
process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }) });
const n = Number(process.argv[2] ?? 12);
const rows = await prisma.errorLog.findMany({ orderBy: { lastSeen: "desc" }, take: n });
for (const r of rows) {
  console.log(`--- ${r.lastSeen.toISOString()}  x${r.count}  ${r.source}  ${r.method ?? ""} ${r.path ?? ""}  resolved=${r.resolved}`);
  console.log("    " + (r.message ?? "").replace(/\s+/g, " ").slice(0, 420));
  if (r.stack) console.log("    at: " + r.stack.split("\n").filter((l) => /app\/|lib\/|components\//.test(l)).slice(0, 3).map((l) => l.trim().slice(0, 140)).join(" | "));
}
await prisma.$disconnect();
