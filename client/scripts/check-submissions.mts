import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const since = new Date(Date.now() - 36 * 60 * 60 * 1000);

const refused = await prisma.refusedSubmission.findMany({
  where: { updatedAt: { gte: since } },
  orderBy: { updatedAt: "desc" },
  select: { spotifyUrl: true, artistEmail: true, reason: true, status: true, attempts: true, updatedAt: true },
});
console.log(`refused submissions in the last 36h: ${refused.length}`);
for (const r of refused) {
  console.log(`  ${r.updatedAt.toISOString()} ${r.status} x${r.attempts} ${r.artistEmail}`);
  console.log(`     ${r.reason?.slice(0, 120)}`);
}

const tracks = await prisma.track.findMany({
  where: { createdAt: { gte: since } },
  orderBy: { createdAt: "desc" },
  select: { title: true, artistName: true, createdAt: true },
});
console.log(`\ntracks added in the last 36h: ${tracks.length}`);
for (const t of tracks.slice(0, 8)) console.log(`  ${t.createdAt.toISOString()} ${t.title} — ${t.artistName}`);

const hits = await prisma.requestHit.groupBy({
  by: ["bucket"],
  where: { createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
  _count: { _all: true },
});
console.log("\nrate-limit buckets used in the last 6h:");
for (const h of hits) console.log(`  ${h.bucket}  ${h._count._all}`);
