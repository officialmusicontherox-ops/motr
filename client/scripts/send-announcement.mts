/**
 * One-off: emails everyone who has signed in, describing what MOTR is.
 *
 *   dry run:  DATABASE_URL=... npx tsx scripts/send-announcement.mts
 *   send:     DATABASE_URL=... npx tsx scripts/send-announcement.mts --send
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sendEmail, whatMotrIsEmail } from "../lib/email";
import { unsubscribeUrl } from "../lib/nudges";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const APP = "https://app.musicontherox.com";
const live = process.argv.includes("--send");

const fans = await prisma.fan.findMany({
  where: { email: { not: null }, emailOptOut: false },
  select: { id: true, email: true, username: true },
  orderBy: { createdAt: "asc" },
});

console.log(`${live ? "SENDING" : "DRY RUN"} — ${fans.length} signed-in listeners\n`);

let sent = 0, failed = 0;
for (const fan of fans) {
  const masked = fan.email!.replace(/(.{2}).*(@.*)/, "$1***$2");
  if (!live) { console.log(`  would email ${fan.username.padEnd(22)} ${masked}`); continue; }

  const res = await sendEmail(
    fan.email!,
    whatMotrIsEmail({ unsubscribeUrl: unsubscribeUrl(fan.id, APP) })
  );
  res.ok ? sent++ : failed++;
  console.log(`  ${res.ok ? "sent" : "FAILED"}  ${masked}${res.ok ? "" : "  " + res.error}`);
  // Resend rate-limits; a short gap keeps a batch this size well inside it.
  await new Promise((r) => setTimeout(r, 600));
}

if (live) console.log(`\nsent ${sent}, failed ${failed}`);
