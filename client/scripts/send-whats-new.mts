/**
 * The two "what's new" rounds.
 *
 *   npx tsx --env-file=.env scripts/send-whats-new.mts                 preview
 *   npx tsx --env-file=.env scripts/send-whats-new.mts --test me@x.com both, to one address
 *   npx tsx --env-file=.env scripts/send-whats-new.mts --send artists
 *   npx tsx --env-file=.env scripts/send-whats-new.mts --send listeners
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sendEmail, whatsNewArtistEmail, whatsNewListenerEmail, toPlainText } from "../lib/email";
import { unsubscribeUrl } from "../lib/nudges";

const APP = process.env.APP_URL;
if (!APP || !/^https:\/\//.test(APP) || /localhost/.test(APP)) {
  console.error(`APP_URL is ${APP ?? "not set"}. The logo and links are absolute, so it needs the real one.`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const args = process.argv.slice(2);
const testTo = args.includes("--test") ? args[args.indexOf("--test") + 1] : null;
const which = args.includes("--send") ? args[args.indexOf("--send") + 1] : null;

const artists = await prisma.artist.findMany({
  where: { emailOptOut: false, tracks: { some: { status: { not: "REJECTED" } } } },
  select: { id: true, name: true, email: true },
});
const fans = await prisma.fan.findMany({
  where: { email: { not: null }, emailOptOut: false },
  select: { id: true, email: true },
});
// Someone who is both hears about their own side only; the artist letter
// already covers everything the listener one says they can do.
const artistEmails = new Set(artists.map((a) => a.email.toLowerCase()));
const listeners = fans.filter((f) => f.email && !artistEmails.has(f.email.toLowerCase()));

console.log(`artists   : ${artists.length}`);
console.log(`listeners : ${listeners.length} (after removing ${fans.length - listeners.length} who are also artists)`);

if (testTo) {
  const a = await sendEmail(testTo, whatsNewArtistEmail({ name: artists[0]?.name ?? "there", appUrl: APP }));
  const l = await sendEmail(testTo, whatsNewListenerEmail({ appUrl: APP }));
  console.log(`\nartist test   : ${a.ok ? "sent" : a.error}`);
  console.log(`listener test : ${l.ok ? "sent" : l.error}`);
  process.exit(0);
}

if (!which) {
  const sample = whatsNewArtistEmail({ name: "Example", appUrl: APP });
  console.log(`\nartist subject   : ${sample.subject}`);
  console.log(`listener subject : ${whatsNewListenerEmail({ appUrl: APP }).subject}`);
  console.log(`\n--- artist, as text ---\n${toPlainText(sample.html).slice(0, 700)}`);
  console.log("\nNothing sent. Pass --send artists or --send listeners.");
  process.exit(0);
}

let sent = 0;
let failed = 0;
if (which === "artists") {
  for (const a of artists) {
    const r = await sendEmail(a.email, whatsNewArtistEmail({ name: a.name, appUrl: APP }));
    r.ok ? sent++ : failed++;
  }
} else if (which === "listeners") {
  for (const f of listeners) {
    const r = await sendEmail(f.email!, whatsNewListenerEmail({ appUrl: APP }));
    void unsubscribeUrl;
    r.ok ? sent++ : failed++;
  }
} else {
  console.log("--send takes 'artists' or 'listeners'");
  process.exit(1);
}
console.log(`\n${which}: sent ${sent}, failed ${failed}`);
await prisma.$disconnect();
