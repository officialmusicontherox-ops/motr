/** Did the milestone send record itself, and is anyone still due? */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pendingMilestones } from "../lib/artistMilestones";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const sent = await prisma.artistNotification.findMany({
  where: { type: { startsWith: "RIGHT_SWIPES_" } },
  select: { type: true, sentAt: true, artist: { select: { name: true } } },
  orderBy: { sentAt: "desc" },
});

const byArtist = new Map<string, number>();
for (const n of sent) byArtist.set(n.artist.name, (byArtist.get(n.artist.name) ?? 0) + 1);

console.log(`milestone records written: ${sent.length} across ${byArtist.size} artists`);
for (const [name, n] of byArtist) console.log(`  ${name}: ${n} track${n === 1 ? "" : "s"}`);

const stillDue = await pendingMilestones();
console.log(`\nstill due: ${stillDue.length} artists`);
