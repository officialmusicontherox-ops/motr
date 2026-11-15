/**
 * The Spotlights and Battles update, to artists and to listeners who have
 * an email.
 *
 *   preview:  npx tsx scripts/send-week-update.mts
 *   send now: set -a; . ./.env; set +a; DATABASE_URL="$DATABASE_URL_NEON" npx tsx scripts/send-week-update.mts --send --now
 *   schedule: same, with --at 2026-11-15T15:00:00Z in place of --now
 *
 * The environment has to be loaded before the script starts, as above:
 * lib/email reads its keys when it is imported, which is before this file
 * could load them itself.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { unsubscribeUrl, artistUnsubscribeUrl } from "../lib/nudges.ts";

process.loadEnvFile(".env");

/**
 * Point the shared client at production before lib/email loads.
 *
 * sendEmail checks the suppression list through lib/prisma, which reads
 * DATABASE_URL. Left alone that is localhost, and the first recipient dies
 * on a connection error before anything reaches Resend. The import has to
 * be dynamic for the same reason: a static one is hoisted above this line.
 */
process.env.DATABASE_URL = process.env.DATABASE_URL_NEON;
const { sendEmail, spotlightsAndBattlesEmail } = await import("../lib/email.ts");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }),
});

const APP = "https://app.musicontherox.com";
const live = process.argv.includes("--send");
const at = process.argv.includes("--at")
  ? process.argv[process.argv.indexOf("--at") + 1]
  : undefined;

if (live && !at && !process.argv.includes("--now")) {
  console.error("  say when: --now, or --at <ISO time>");
  process.exit(1);
}


const artists = await prisma.artist.findMany({
  where: { emailOptOut: false, email: { not: "" } },
  select: { id: true, email: true },
  orderBy: { createdAt: "asc" },
});
const fans = await prisma.fan.findMany({
  where: { emailOptOut: false, email: { not: null } },
  select: { id: true, email: true },
  orderBy: { createdAt: "asc" },
});

/** One message per address. Plenty of artists are listeners too. */
const seen = new Set<string>();
const list: { email: string; unsub: string; kind: "artist" | "listener" }[] = [];

for (const a of artists) {
  const e = a.email.trim().toLowerCase();
  if (!e || seen.has(e)) continue;
  seen.add(e);
  list.push({ email: a.email, unsub: artistUnsubscribeUrl(a.id, APP), kind: "artist" });
}
for (const f of fans) {
  const e = (f.email ?? "").trim().toLowerCase();
  if (!e || seen.has(e)) continue;
  seen.add(e);
  list.push({ email: f.email!, unsub: unsubscribeUrl(f.id, APP), kind: "listener" });
}

console.log(
  `  ${live ? (at ? `SCHEDULING for ${at}` : "SENDING NOW") : "PREVIEW"}: ${list.length} recipients ` +
    `(${list.filter((r) => r.kind === "artist").length} artists, ` +
    `${list.filter((r) => r.kind === "listener").length} listeners)\n`
);

if (!live) {
  const sample = spotlightsAndBattlesEmail({ unsubscribeUrl: "https://example.invalid" });
  console.log(`  SUBJECT: ${sample.subject}\n`);
  console.log(
    sample.html
      .replace(/<li[^>]*>/g, "\n  - ")
      .replace(/<\/p>|<\/h1>|<\/ul>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n")
  );
  await prisma.$disconnect();
  process.exit(0);
}

let ok = 0;
let failed = 0;
for (const r of list) {
  const masked = r.email.replace(/(.{2}).*(@.*)/, "$1***$2");
  let res: { ok: boolean; error?: string };
  try {
    res = await sendEmail(r.email, spotlightsAndBattlesEmail({ unsubscribeUrl: r.unsub }), {
      scheduledAt: at,
    });
  } catch (e) {
    res = { ok: false, error: String(e) };
  }
  res.ok ? ok++ : failed++;
  if (!res.ok) console.log(`  FAILED ${masked}  ${res.error}`);
  // Resend rate-limits on the API call, not on the delivery time, so this
  // gap matters even though every message lands at once.
  await new Promise((r) => setTimeout(r, 600));
}
console.log(`\n  ${at ? "scheduled" : "sent"} ${ok}, failed ${failed}${at ? ", all for " + at : ""}`);

await prisma.$disconnect();
