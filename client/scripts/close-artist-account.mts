/**
 * Takes an artist account out of everything without deleting it: no email
 * of any kind, and any track still live is pulled.
 *
 *   npx tsx scripts/close-artist-account.mts <artistId>
 *
 * The row is kept because the track and the listens against it point at it.
 * Somebody who comes back submits again with a working address and gets a
 * new account.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }) });
const id = process.argv[2];
if (!id) { console.error("  usage: close-artist-account.mts <artistId>"); process.exit(1); }

await prisma.$transaction([
  prisma.artist.update({
    where: { id },
    data: { emailOptOut: true, emailOptOutAt: new Date(), emailOptOutBy: "admin" },
  }),
  prisma.track.updateMany({ where: { artistId: id, status: { not: "REJECTED" } }, data: { status: "REJECTED" } }),
]);

const a = await prisma.artist.findUnique({
  where: { id },
  select: { name: true, email: true, emailOptOut: true, emailOptOutBy: true, tracks: { select: { title: true, status: true } } },
});
console.log(`  ${a?.name} <${a?.email}>  emails off: ${a?.emailOptOut} (by ${a?.emailOptOutBy})`);
for (const t of a?.tracks ?? []) console.log(`    ${t.status.padEnd(10)} ${t.title}`);

const onPlatform = await prisma.artist.count({ where: { tracks: { some: { status: { not: "REJECTED" } } } } });
const emailable = await prisma.artist.count({ where: { emailOptOut: false, email: { not: "" } } });
console.log(`\n  artists on the platform (dashboard number): ${onPlatform}`);
console.log(`  artists a mass email goes to: ${emailable}`);
await prisma.$disconnect();
