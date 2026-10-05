/** Who the share-card announcement would go to, and what it looks like. Sends nothing. */
import fs from "fs";
import { pendingSharePageArtists } from "../lib/artistSharePage";
import { artistSharePageEmail } from "../lib/email";
import { renderShareCard } from "../lib/shareCard";

/**
 * Refuses to run against a dev URL.
 *
 * The email embeds the card by absolute URL, and APP_URL falls back to
 * localhost outside production. A send with that fallback in place mails
 * everybody a broken image, which is exactly what happened the first time.
 */
function requirePublicAppUrl() {
  const url = process.env.APP_URL;
  if (!url || !/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) {
    console.error(
      `APP_URL is ${url ?? "not set"}. The card is embedded by absolute URL, so this would send a broken image.\n` +
        `Run it with:  npx tsx --env-file=.env scripts/<script>`
    );
    process.exit(1);
  }
}
requirePublicAppUrl();


const out = process.argv[2] ?? "/tmp/motr-share-email.html";
const due = await pendingSharePageArtists();

console.log(`${due.length} artists would be emailed\n`);
for (const r of due) {
  console.log(`  ${r.name.padEnd(28)} ${r.email.padEnd(34)} ${r.tracks.length} track(s): ${r.tracks.slice(0, 3).map((t) => t.title).join(", ")}`);
}

const sample = due[0];
if (!sample) { console.log("\nNobody is due."); process.exit(0); }

const card = await renderShareCard({
  trackId: sample.tracks[0].id, title: sample.tracks[0].title, artistName: sample.name, square: false,
});
const bytes = Buffer.from(await card.arrayBuffer()).length;

const mail = artistSharePageEmail({ name: sample.name, tracks: sample.tracks });
fs.writeFileSync(out, mail.html);
console.log(`\nSample: ${sample.name}`);
console.log(`Subject: ${mail.subject}`);
console.log(`Attachment would be ~${Math.round(bytes / 1024)}KB per card, up to 3 cards`);
console.log(`HTML written to ${out}`);
