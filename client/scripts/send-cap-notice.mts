/**
 * Tells one buyer their Spotlights were rearranged by the cap.
 *
 *   preview: npx tsx scripts/send-cap-notice.mts
 *   send:    DATABASE_URL=$NEON npx tsx scripts/send-cap-notice.mts --send
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { unsubscribeUrl } from "../lib/nudges.ts";

process.loadEnvFile(".env");
process.env.DATABASE_URL = process.env.DATABASE_URL_NEON;
const { sendEmail, spotlightCapEmail } = await import("../lib/email.ts");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const APP = "https://app.musicontherox.com";
const live = process.argv.includes("--send");
const ARTIST = "DJ Rittenhouse";

const now = new Date();
const rows = await prisma.spotlight.findMany({
  where: { artist: { name: ARTIST } },
  select: { fanId: true, startsAt: true, endsAt: true },
});
const running = rows.filter((r) => r.startsAt && r.endsAt && r.endsAt > now).length;
const waiting = rows.filter((r) => !r.startsAt).length;

const fanId = rows.find((r) => r.fanId)?.fanId;
if (!fanId) { console.error("  no buyer on those rows"); process.exit(1); }
const fan = await prisma.fan.findUnique({
  where: { id: fanId },
  select: { email: true, emailOptOut: true, username: true },
});
if (!fan?.email) { console.error("  buyer has no email"); process.exit(1); }

const tpl = spotlightCapEmail({
  artist: ARTIST,
  live: running,
  queued: waiting,
  unsubscribeUrl: unsubscribeUrl(fanId, APP),
});

console.log(`  ${live ? "SENDING" : "PREVIEW"} to ${fan.username} <${fan.email}>`);
console.log(`  running now: ${running}, queued: ${waiting}, optOut: ${fan.emailOptOut}\n`);
console.log(`  SUBJECT: ${tpl.subject}\n`);
console.log(
  tpl.html
    .replace(/<\/p>|<\/h1>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
);

if (live) {
  const res = await sendEmail(fan.email, tpl);
  console.log(`\n  ${res.ok ? "sent" : "FAILED " + res.error}`);
}
await prisma.$disconnect();
