/** Who the share-card announcement would go to, and what it looks like. Sends nothing. */
import fs from "fs";
import { pendingSharePageArtists } from "../lib/artistSharePage";
import { artistSharePageEmail } from "../lib/email";
import { renderShareCard } from "../lib/shareCard";

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
