import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const now = new Date();
const rows = await prisma.spotlight.findMany({
  where: { artist: { name: "DJ Rittenhouse" } },
  orderBy: { startsAt: "asc" },
  select: { id: true, startsAt: true, endsAt: true, fanId: true, createdAt: true },
});

console.log(`  now: ${now.toISOString()}\n`);
for (const r of rows) {
  const left = r.endsAt ? r.endsAt.getTime() - now.getTime() : null;
  console.log(
    `  ${r.id}  starts ${r.startsAt?.toISOString() ?? "queued"}  ends ${r.endsAt?.toISOString() ?? "-"}  ` +
      `left ${left === null ? "-" : (left / 3_600_000).toFixed(1) + "h"}`
  );
}

const buyers = [...new Set(rows.map((r) => r.fanId).filter(Boolean))] as string[];
for (const id of buyers) {
  const f = await prisma.fan.findUnique({
    where: { id },
    select: { username: true, email: true, spotlightCredits: true, emailOptOut: true },
  });
  console.log(
    `\n  buyer ${f?.username}  email ${f?.email ?? "NONE"}  holding ${f?.spotlightCredits}  optOut ${f?.emailOptOut}`
  );
}

await prisma.$disconnect();
