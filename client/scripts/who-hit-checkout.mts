import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Who ran into the bad API key on /api/spotlight/checkout.
 *
 * The route refuses anyone without a session, so whoever hit it was a
 * signed-in listener. This looks at the user agent on the error and at who
 * was active around that minute, which is as close as the data gets.
 */
process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const err = await prisma.errorLog.findFirst({
  where: { path: { contains: "spotlight/checkout" } },
  orderBy: { lastSeen: "desc" },
});

if (!err) {
  console.log("  no checkout error found");
} else {
  console.log(`  first seen : ${err.firstSeen.toISOString()}`);
  console.log(`  last seen  : ${err.lastSeen.toISOString()}`);
  console.log(`  times      : ${err.count}`);
  console.log(`  method     : ${err.method ?? "-"}`);
  console.log(`  userAgent  : ${err.userAgent ?? "(none recorded)"}`);

  // Anyone swiping within twenty minutes either side.
  const from = new Date(err.firstSeen.getTime() - 20 * 60 * 1000);
  const to = new Date(err.lastSeen.getTime() + 20 * 60 * 1000);
  const near = await prisma.fanSwipe.findMany({
    where: { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, fanId: true, direction: true },
  });
  console.log(`\n  swipes within 20 min either side: ${near.length}`);
  const fans = [...new Set(near.map((s) => s.fanId))];
  console.log(`  distinct listeners active: ${fans.length}`);
  for (const s of near.slice(0, 12)) {
    console.log(`    ${s.createdAt.toISOString()}  ${s.direction}  fan ${s.fanId.slice(0, 8)}`);
  }

  for (const f of fans) {
    const fan = await prisma.fan.findUnique({
      where: { id: f },
      select: { username: true, createdAt: true, googleId: true, spotifyId: true },
    });
    console.log(
      `    listener ${f.slice(0, 8)}  joined ${fan?.createdAt.toISOString().slice(0, 10)}  signed in: ${
        fan?.googleId ? "google" : fan?.spotifyId ? "spotify" : "anonymous"
      }`
    );
  }
}

await prisma.$disconnect();
