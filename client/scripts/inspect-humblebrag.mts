import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const a = await prisma.artist.findFirst({
  where: { email: { contains: "thehumblebrag" } },
  select: {
    id: true,
    name: true,
    email: true,
    createdAt: true,
    tracks: { select: { title: true, status: true, createdAt: true } },
  },
});
console.log(JSON.stringify(a, null, 2));

/** Any other address that looks like it has no top-level domain. */
const all = await prisma.artist.findMany({ select: { id: true, name: true, email: true } });
const bad = all.filter((x) => {
  const e = (x.email ?? "").trim();
  if (!e) return false;
  const at = e.lastIndexOf("@");
  if (at < 1) return true;
  const domain = e.slice(at + 1);
  return !/\.[a-z]{2,}$/i.test(domain);
});
console.log(`\n  artists with an unusable address: ${bad.length}`);
for (const b of bad) console.log(`    ${b.name} — ${b.email}`);

const fans = await prisma.fan.findMany({
  where: { email: { not: null } },
  select: { id: true, username: true, email: true },
});
const badFans = fans.filter((x) => {
  const e = (x.email ?? "").trim();
  const at = e.lastIndexOf("@");
  if (at < 1) return true;
  return !/\.[a-z]{2,}$/i.test(e.slice(at + 1));
});
console.log(`  listeners with an unusable address: ${badFans.length}`);
for (const b of badFans) console.log(`    ${b.username} — ${b.email}`);

await prisma.$disconnect();
