/**
 * Pulls every live track of one artist account out of rotation, the same
 * way the admin panel does: status REJECTED, rows kept, reversible.
 *
 *   dry run: npx tsx scripts/pull-artist-tracks.mts <artistId>
 *   apply:   npx tsx scripts/pull-artist-tracks.mts <artistId> --apply
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }) });
const artistId = process.argv[2];
const apply = process.argv.includes("--apply");
if (!artistId) { console.error("  usage: pull-artist-tracks.mts <artistId> [--apply]"); process.exit(1); }

const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { name: true, email: true } });
const tracks = await prisma.track.findMany({ where: { artistId }, select: { id: true, title: true, status: true } });
console.log(`  ${artist?.name} <${artist?.email}>`);
for (const t of tracks) console.log(`    ${t.status.padEnd(10)} ${t.title}`);

if (apply) {
  const { count } = await prisma.track.updateMany({
    where: { artistId, status: { not: "REJECTED" } },
    data: { status: "REJECTED" },
  });
  console.log(`\n  pulled ${count} track(s)`);
  const after = await prisma.track.findMany({ where: { artistId }, select: { title: true, status: true } });
  for (const t of after) console.log(`    ${t.status.padEnd(10)} ${t.title}`);
} else {
  console.log("\n  dry run. pass --apply to pull them");
}
await prisma.$disconnect();
