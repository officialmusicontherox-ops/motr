/**
 * The Thanksgiving week Spotlight sale email, to every artist with music on
 * MOTR and every listener with an address, nobody twice, nobody who has
 * opted out. Preview by default; --send to send.
 */
import fs from "node:fs";
const { prisma } = await import("../lib/prisma.ts");
const { thanksgivingSaleEmail, sendEmail, toPlainText } = await import("../lib/email.ts");
const { artistUnsubscribeUrl, unsubscribeUrl } = await import("../lib/nudges.ts");
const { isEmailAddress } = await import("../lib/emailAddress.ts");
const APP = "https://app.musicontherox.com";

const artists = await prisma.artist.findMany({
  where: { emailOptOut: false, tracks: { some: { status: { not: "REJECTED" } } } },
  select: { id: true, email: true },
});
const fans = await prisma.fan.findMany({
  where: { emailOptOut: false, email: { not: null } },
  select: { id: true, email: true },
});
const seen = new Set<string>();
const list: { email: string; listener: boolean; unsub: string }[] = [];
for (const a of artists) {
  const e = a.email.trim().toLowerCase();
  if (!isEmailAddress(e) || seen.has(e)) continue;
  seen.add(e);
  list.push({ email: e, listener: false, unsub: artistUnsubscribeUrl(a.id, APP) });
}
for (const f of fans) {
  const e = (f.email ?? "").trim().toLowerCase();
  if (!isEmailAddress(e) || seen.has(e)) continue;
  seen.add(e);
  list.push({ email: e, listener: true, unsub: unsubscribeUrl(f.id, APP) });
}
const a = thanksgivingSaleEmail({ listener: false, unsubscribeUrl: `${APP}/unsubscribe` });
const l = thanksgivingSaleEmail({ listener: true, unsubscribeUrl: `${APP}/unsubscribe` });
fs.writeFileSync("/mnt/shared/MyFiles/Downloads/MOTR Thanksgiving email preview.html", `<!doctype html><meta charset="utf-8">` + a.html);
console.log(`  artists: ${list.filter((x) => !x.listener).length}, listeners: ${list.filter((x) => x.listener).length}\n  subject: ${a.subject}\n`);
if (!process.argv.includes("--send")) {
  console.log("--- artist version ---\n" + toPlainText(a.html));
  console.log("\n--- listener version differs only in: ---\n" + toPlainText(l.html).split("\n").filter((x) => !toPlainText(a.html).includes(x)).join("\n"));
  process.exit(0);
}
let sent = 0, skipped = 0;
for (const r of list) {
  const res = await sendEmail(r.email, thanksgivingSaleEmail({ listener: r.listener, unsubscribeUrl: r.unsub }));
  if (res.ok) sent++; else skipped++;
  await new Promise((x) => setTimeout(x, 300));
}
console.log(`  SENT ${sent}, not sent ${skipped}`);
process.exit(0);
