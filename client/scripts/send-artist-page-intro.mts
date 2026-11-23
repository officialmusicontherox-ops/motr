/**
 * The artist page introduction, to every artist with music on MOTR who has
 * not opted out. Preview by default; --send to send.
 *
 *   set -a; . ./.env; set +a; DATABASE_URL="$DATABASE_URL_NEON" npx tsx scripts/send-artist-page-intro.mts [--send]
 */
import fs from "node:fs";
const { prisma } = await import("../lib/prisma.ts");
const { artistPageIntroEmail, sendEmail, toPlainText } = await import("../lib/email.ts");
const { artistUnsubscribeUrl } = await import("../lib/nudges.ts");
const { isEmailAddress } = await import("../lib/emailAddress.ts");
const APP = "https://app.musicontherox.com";

const artists = await prisma.artist.findMany({
  where: { emailOptOut: false, tracks: { some: { status: { not: "REJECTED" } } } },
  select: { id: true, email: true },
});
const to = artists.filter((a) => isEmailAddress(a.email));
const sample = artistPageIntroEmail({ unsubscribeUrl: `${APP}/unsubscribe` });
fs.writeFileSync("/mnt/shared/MyFiles/Downloads/MOTR artist page email preview.html", `<!doctype html><meta charset="utf-8">` + sample.html);
console.log(`  recipients: ${to.length}\n  subject   : ${sample.subject}\n`);
if (!process.argv.includes("--send")) {
  console.log(toPlainText(sample.html));
  console.log("\n  preview only, nothing sent");
  process.exit(0);
}
// --at=ISO schedules with Resend, spaced 10 seconds apart from that moment.
const at = process.argv.find((x) => x.startsWith("--at="))?.slice(5);
const start = at ? Date.parse(at) : NaN;
let sent = 0, failed = 0, i = 0;
for (const a of to) {
  const scheduledAt = Number.isFinite(start) ? new Date(start + i * 10_000).toISOString() : undefined;
  const r = await sendEmail(a.email, artistPageIntroEmail({ unsubscribeUrl: artistUnsubscribeUrl(a.id, APP) }), { scheduledAt });
  i++;
  if (r.ok) sent++; else failed++;
  await new Promise((x) => setTimeout(x, 300));
}
console.log(`  ${Number.isFinite(start) ? "SCHEDULED" : "SENT"} ${sent}, failed ${failed}${Number.isFinite(start) ? ` (from ${new Date(start).toISOString()})` : ""}`);
process.exit(0);
