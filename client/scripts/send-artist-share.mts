/**
 * Sends the share-card announcement.
 *
 *   npx tsx scripts/send-artist-share.mts --test you@example.com   one copy, nothing recorded
 *   npx tsx scripts/send-artist-share.mts --send                   the real thing
 *
 * Without a flag it does nothing, because a script that mails sixty people by
 * default is a script that eventually does.
 */
import { pendingSharePageArtists, sendSharePageEmails } from "../lib/artistSharePage";
import { artistSharePageEmail, sendEmail } from "../lib/email";
import { renderShareCard } from "../lib/shareCard";

const args = process.argv.slice(2);
const testTo = args.includes("--test") ? args[args.indexOf("--test") + 1] : null;
const live = args.includes("--send");

const due = await pendingSharePageArtists();

if (testTo) {
  const sample = due[0];
  if (!sample) { console.log("Nobody is due, so there is nothing to show."); process.exit(0); }

  const cards = [];
  for (const t of sample.tracks.slice(0, 3)) {
    const res = await renderShareCard({ trackId: t.id, title: t.title, artistName: sample.name, square: false });
    cards.push({
      filename: `motr-${t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "track"}-story.png`,
      content: Buffer.from(await res.arrayBuffer()),
    });
  }

  const result = await sendEmail(
    testTo,
    artistSharePageEmail({ name: sample.name, tracks: sample.tracks, attachments: cards })
  );
  console.log(
    result.ok
      ? `Test sent to ${testTo} as "${sample.name}" with ${cards.length} card(s) attached. Nothing recorded.`
      : `Test failed: ${result.error}`
  );
  process.exit(result.ok ? 0 : 1);
}

if (!live) {
  console.log(`${due.length} artists are due. Nothing sent. Pass --send to actually send, or --test <email> for one copy.`);
  process.exit(0);
}

console.log(`Sending to ${due.length} artists...`);
const result = await sendSharePageEmails();
console.log(`sent ${result.sent}, failed ${result.failed}, of ${result.eligible} eligible`);
for (const f of result.failures) console.log(`   failed: ${f.email} (${f.error})`);
