import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
process.env.DATABASE_URL = process.env.DATABASE_URL;

const { spendCredit, NoCreditsError, SLOTS } = await import("../lib/spotlight.ts");

const pass = (m: string) => console.log("  PASS  " + m);
const fail = (m: string) => { console.log("  FAIL  " + m); process.exitCode = 1; };

const id = () => crypto.randomBytes(4).toString("hex");

async function main() {
  const artist = await prisma.artist.create({
    data: { name: "Spend Test " + id(), email: `spend-${id()}@example.invalid` },
  });
  const fan = await prisma.fan.create({
    data: { username: "spend-" + id(), spotlightCredits: 2 },
  });

  // 1. A normal spend.
  const r1 = await spendCredit(fan.id, artist.id, null);
  r1.left === 1 ? pass("spend took one: 2 -> 1") : fail(`left is ${r1.left}, expected 1`);
  const live = await prisma.spotlight.count({ where: { artistId: artist.id } });
  live === 1 ? pass("one Spotlight row created") : fail(`${live} rows`);

  // 2. Down to zero, then one too many.
  await spendCredit(fan.id, artist.id, null);
  const after = await prisma.fan.findUnique({ where: { id: fan.id }, select: { spotlightCredits: true } });
  after?.spotlightCredits === 0 ? pass("balance reached 0") : fail(`balance ${after?.spotlightCredits}`);

  try {
    await spendCredit(fan.id, artist.id, null);
    fail("spending with 0 left was allowed");
  } catch (e) {
    e instanceof NoCreditsError ? pass("spending with 0 left refused") : fail(`wrong error: ${e}`);
  }

  // 3. Two taps landing together on a single credit.
  await prisma.fan.update({ where: { id: fan.id }, data: { spotlightCredits: 1 } });
  const both = await Promise.allSettled([
    spendCredit(fan.id, artist.id, null),
    spendCredit(fan.id, artist.id, null),
  ]);
  const ok = both.filter((r) => r.status === "fulfilled").length;
  const bal = (await prisma.fan.findUnique({ where: { id: fan.id }, select: { spotlightCredits: true } }))?.spotlightCredits;
  ok === 1 && bal === 0
    ? pass("two simultaneous spends on one credit: exactly one won")
    : fail(`${ok} succeeded, balance ${bal}`);

  // 4. Past six slots, a purchase waits instead of losing its week.
  const extras = [];
  for (let i = 0; i < SLOTS + 1; i++) {
    extras.push(await prisma.artist.create({
      data: { name: `Queue Test ${i} ${id()}`, email: `q${i}-${id()}@example.invalid` },
    }));
  }
  await prisma.fan.update({ where: { id: fan.id }, data: { spotlightCredits: SLOTS + 1 } });
  let queued = 0;
  for (const a of extras) {
    const r = await spendCredit(fan.id, a.id, null);
    if (r.queued) queued++;
  }
  queued >= 1 ? pass(`past ${SLOTS} slots a Spotlight queues rather than starting`) : fail("nothing queued");

  const started = await prisma.spotlight.count({ where: { startsAt: { not: null } } });
  started <= SLOTS ? pass(`never more than ${SLOTS} live at once (${started})`) : fail(`${started} live`);

  await prisma.spotlight.deleteMany({ where: { fanId: fan.id } });
  await prisma.fan.delete({ where: { id: fan.id } });
  await prisma.artist.deleteMany({ where: { id: { in: [artist.id, ...extras.map((a) => a.id)] } } });
  console.log("\n  cleaned up");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
