/**
 * Reports any track whose preview no longer plays.
 *
 * Preview URLs rot: Deezer signs and expires them, and even iTunes assets
 * move. A silent track is invisible from the admin dashboard and reads to a
 * listener as a broken app, so this is worth running periodically.
 *
 *   DATABASE_URL="$NEON" node scripts/check-previews.mjs
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const tracks = await prisma.track.findMany({
  where: { status: "DISCOVERY" },
  select: { id: true, title: true, artistName: true, previewUrl: true },
});

const broken = [];
for (let i = 0; i < tracks.length; i += 10) {
  const batch = tracks.slice(i, i + 10);
  const results = await Promise.all(
    batch.map(async (t) => {
      try {
        const r = await fetch(t.previewUrl, { headers: { Range: "bytes=0-500" } });
        return r.ok ? null : t;
      } catch {
        return t;
      }
    })
  );
  broken.push(...results.filter(Boolean));
}

console.log(`${tracks.length - broken.length}/${tracks.length} playable`);
for (const b of broken) console.log(`  BROKEN  ${b.artistName} — ${b.title}`);
if (broken.length) process.exitCode = 1;

await prisma.$disconnect();
