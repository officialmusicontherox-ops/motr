import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
/** The battle an artist is in this week, and who they face. Read-only. */
process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }) });
const name = process.argv[2] ?? "";
const tracks = await prisma.track.findMany({
  where: { artistName: { contains: name, mode: "insensitive" } },
  select: { id: true, title: true, artistName: true, status: true },
});
for (const t of tracks) {
  const b = await prisma.battle.findFirst({
    where: { settledAt: null, OR: [{ trackAId: t.id }, { trackBId: t.id }] },
  });
  if (!b) { console.log(`  ${t.artistName} · ${t.title} (${t.status}): not in a battle`); continue; }
  const otherId = b.trackAId === t.id ? b.trackBId : b.trackAId;
  const o = await prisma.track.findUnique({ where: { id: otherId }, select: { title: true, artistName: true } });
  const mine = b.trackAId === t.id ? b.votesA : b.votesB;
  const theirs = b.trackAId === t.id ? b.votesB : b.votesA;
  console.log(`  ${t.artistName} · ${t.title} (${t.status})`);
  console.log(`    faces: ${o?.artistName} · ${o?.title}   genre: ${b.genre}   votes: ${mine} to ${theirs}`);
}
if (!tracks.length) console.log("  no tracks found");
await prisma.$disconnect();
