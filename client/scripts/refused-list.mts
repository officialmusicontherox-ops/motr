import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const rows = await prisma.refusedSubmission.findMany({
  orderBy: { updatedAt: "desc" }, take: 25,
  select: { spotifyUrl: true, reason: true, status: true, attempts: true, updatedAt: true },
});
console.log(`refused submissions on record: ${rows.length}`);
const byStatus: Record<string, number> = {};
for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
console.log(byStatus, "\n");
for (const r of rows) {
  console.log(`${r.status.padEnd(8)} x${r.attempts}  ${r.spotifyUrl}`);
  console.log(`         ${(r.reason ?? "").slice(0, 110)}`);
}
