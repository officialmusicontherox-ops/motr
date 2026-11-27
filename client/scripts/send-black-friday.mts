/**
 * The Black Friday Spotlight sale email, to every artist with music on
 * MOTR and every listener with an address, nobody twice, nobody who has
 * opted out. Preview by default; --send to send.
 */
import fs from "node:fs";
const { prisma } = await import("../lib/prisma.ts");
const { blackFridaySaleEmail, sendEmail, toPlainText } = await import("../lib/email.ts");
const { artistUnsubscribeUrl, unsubscribeUrl } = await import("../lib/nudges.ts");
const { isEmailAddress } = await import("../lib/emailAddress.ts");
const APP = "https://app.musicontherox.com";

const artists = await prisma.artist.findMany({
  where: { emailOptOut: false, tracks: { some: { status: { not: "REJECTED" } } } },
  select: { id: true, email: true },
  orderBy: { id: "asc" },
});
const fans = await prisma.fan.findMany({
  where: { emailOptOut: false, email: { not: null } },
  select: { id: true, email: true },
  orderBy: { id: "asc" },
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
const a = blackFridaySaleEmail({ listener: false, unsubscribeUrl: `${APP}/unsubscribe` });
const l = blackFridaySaleEmail({ listener: true, unsubscribeUrl: `${APP}/unsubscribe` });
fs.writeFileSync("/mnt/shared/MyFiles/Downloads/MOTR Black Friday preview.html", `<!doctype html><meta charset="utf-8">` + a.html);
console.log(`  artists: ${list.filter((x) => !x.listener).length}, listeners: ${list.filter((x) => x.listener).length}\n  subject: ${a.subject}\n`);
if (!process.argv.includes("--send")) {
  console.log("--- artist version ---\n" + toPlainText(a.html));
  console.log("\n--- listener version ---\n" + toPlainText(l.html));
  process.exit(0);
}
// Sent in sections: --take=N per run, with a record of who has it so a
// later run (or a rerun after a failure) never sends anyone a second copy.
const LOG = "/tmp/claude-1000/-home-jerrettfranklinmusic-music-discovery-app/d8cd3646-45e5-4efe-ba98-990d1b87f220/scratchpad/blackfriday-sent.txt";
const done = new Set(fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean) : []);
const take = Number(process.argv.find((x) => x.startsWith("--take="))?.slice(7) ?? 50);
const todo = list.filter((r) => !done.has(r.email)).slice(0, take);
let sent = 0, skipped = 0;
for (const r of todo) {
  const res = await sendEmail(r.email, blackFridaySaleEmail({ listener: r.listener, unsubscribeUrl: r.unsub }));
  if (res.ok) sent++; else skipped++;
  // Recorded either way: a refusal is not retried by the next section.
  fs.appendFileSync(LOG, r.email + "\n");
  await new Promise((x) => setTimeout(x, 300));
}
console.log(`  section: SENT ${sent}, not sent ${skipped} | left after this: ${list.length - done.size - todo.length}`);
process.exit(0);
