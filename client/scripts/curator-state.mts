import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const users = await prisma.user.count();
const active = await prisma.user.count({ where: { status: "ACTIVE" } });
const payouts = await prisma.curatorPayout.count();
const assignments = await prisma.curatorAssignment.count();
const pendingApps = await prisma.curatorApplication.count({ where: { status: "PENDING" } }).catch(() => -1);
console.log(`curator accounts ${users} (${active} active) | payouts ${payouts} | assignments ${assignments} | pending applications ${pendingApps}`);
