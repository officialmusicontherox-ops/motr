/** Which tracks the geo-tagged swipes landed on, and whether they count for the A&R panel. */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const rows = await prisma.fanSwipe.findMany({
  where: { countryCode: { not: null } },
  orderBy: { createdAt: "desc" },
  take: 10,
  select: {
    createdAt: true, countryName: true, region: true, city: true, direction: true,
    track: { select: { title: true, artistName: true, artistId: true } },
  },
});

for (const r of rows) {
  const submitted = r.track.artistId !== null;
  console.log(
    `${r.countryName} / ${r.region}  ${r.direction.padEnd(5)}  ` +
      `${submitted ? "SUBMITTED  " : "seeded     "}${r.track.title} — ${r.track.artistName}`
  );
}
const counted = rows.filter((r) => r.track.artistId !== null).length;
console.log(`\n${counted} of ${rows.length} geo-tagged swipes are on submitted tracks (only those show in the A&R panel)`);
