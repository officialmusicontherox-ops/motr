import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * The pool the "every sixth card is a recent submission" boost draws from.
 *
 * If one genre happens to own all five, that boost quietly turns into a
 * genre feed, which is the opposite of what the blind test is for.
 */
process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const recent = await prisma.track.findMany({
  where: { status: "DISCOVERY", artistId: { not: null } },
  orderBy: { createdAt: "desc" },
  take: 10,
  select: { title: true, artistName: true, genre: true, createdAt: true },
});

console.log("  newest artist submissions (the boost uses the top 5):\n");
recent.forEach((t, i) => {
  console.log(
    `  ${i < 5 ? "*" : " "} ${t.createdAt.toISOString().slice(0, 10)}  ${(t.genre ?? "-").padEnd(22)} ${t.artistName.slice(0, 22)}`
  );
});

await prisma.$disconnect();
