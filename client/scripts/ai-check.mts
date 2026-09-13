import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const total = await prisma.track.count({ where: { status: "DISCOVERY" } });
const declaredAi = await prisma.track.count({ where: { status: "DISCOVERY", aiGenerated: true } });
const declaredNot = await prisma.track.count({ where: { status: "DISCOVERY", aiGenerated: false } });
const unasked = await prisma.track.count({ where: { status: "DISCOVERY", aiGenerated: null } });
console.log(`feed: ${total} | declared AI: ${declaredAi} | declared not: ${declaredNot} | never asked: ${unasked}`);
console.log(`with the toggle off, the feed would show ${total - declaredAi}`);
