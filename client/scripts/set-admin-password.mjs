/**
 * Resets an admin's password. There's no in-app UI for this yet.
 *
 *   ADMIN_PW='new-password' DATABASE_URL="$NEON" node scripts/set-admin-password.mjs
 *
 * Leaves the TOTP secret alone, so the authenticator app keeps working.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const email = process.env.ADMIN_EMAIL ?? "officialmusicontherox@gmail.com";
const pw = process.env.ADMIN_PW;
if (!pw) throw new Error("Set ADMIN_PW");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
await prisma.admin.update({
  where: { email },
  data: { passwordHash: await bcrypt.hash(pw, 10) },
});
console.log("Password updated for", email);
await prisma.$disconnect();
