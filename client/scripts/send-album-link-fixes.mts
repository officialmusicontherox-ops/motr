/**
 * Tells artists whose links pointed at an album how to fix it.
 *
 *   npx tsx --env-file=.env scripts/send-album-link-fixes.mts            preview
 *   npx tsx --env-file=.env scripts/send-album-link-fixes.mts --test me@x.com
 *   npx tsx --env-file=.env scripts/send-album-link-fixes.mts --send
 */
import { artistsStuckOnAlbumLinks, sendAlbumLinkFixes } from "../lib/albumLinkRecovery";
import { albumLinkFixEmail, sendEmail } from "../lib/email";

const APP = process.env.APP_URL;
if (!APP || !/^https:\/\//.test(APP) || /localhost/.test(APP)) {
  console.error(`APP_URL is ${APP ?? "not set"}. The email links to the submit page, so it needs the real one.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const testTo = args.includes("--test") ? args[args.indexOf("--test") + 1] : null;
const live = args.includes("--send");

const due = await artistsStuckOnAlbumLinks();
console.log(`${due.length} artist(s) to tell:\n`);
for (const a of due) {
  console.log(`  ${a.email.padEnd(34)} ${a.count} album link(s)  ${a.name ?? "(no artist record)"}`);
}

if (testTo) {
  const sample = due[0];
  if (!sample) process.exit(0);
  const r = await sendEmail(testTo, albumLinkFixEmail({ name: sample.name, count: sample.count, appUrl: APP }));
  console.log(r.ok ? `\nTest sent to ${testTo}. Nothing recorded.` : `\nTest failed: ${r.error}`);
  process.exit(r.ok ? 0 : 1);
}

if (!live) {
  console.log("\nNothing sent. Pass --send to send, or --test <email> for one copy.");
  process.exit(0);
}

const res = await sendAlbumLinkFixes(APP);
console.log(`\nsent ${res.sent}, failed ${res.failed}, of ${res.eligible}`);
