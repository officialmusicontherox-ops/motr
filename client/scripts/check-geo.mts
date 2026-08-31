/** Did the last few swipes record where they came from? */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const rows = await prisma.fanSwipe.findMany({
  orderBy: { createdAt: "desc" },
  take: 5,
  select: { createdAt: true, countryCode: true, countryName: true, region: true, city: true },
});
for (const r of rows) {
  const has = r.countryCode || r.region || r.city;
  console.log(
    `${r.createdAt.toISOString()}  ${has ? "GEO OK" : "no geo"}  ` +
      `${r.countryName ?? r.countryCode ?? "-"} / ${r.region ?? "-"} / ${r.city ?? "-"}`
  );
}
const withGeo = await prisma.fanSwipe.count({ where: { countryCode: { not: null } } });
console.log(`\nswipes carrying geography: ${withGeo}`);
