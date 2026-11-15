/**
 * Sends the "your song is in a battle" email, the same send the button in
 * the admin Battles tab does, from the command line.
 *
 *   preview: set -a; . ./.env; set +a; DATABASE_URL="$DATABASE_URL_NEON" npx tsx scripts/send-battle-notice.mts
 *   send:    the same, with --send
 *
 * The environment is loaded before the script starts because lib/email
 * reads its keys when it is imported.
 */
const N = await import("../lib/battleNotice.ts");
const APP = "https://app.musicontherox.com";

const p = await N.previewBattleNotice();
console.log(`  week: ${p.weekLabel}   battles: ${p.battles}   artists to email: ${p.toSend}   unreachable: ${p.unreachable}`);

if (process.argv.includes("--send")) {
  const sum = { sent: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < 80; i++) {
    const r = await N.sendBattleNotice(APP);
    sum.sent += r.sent; sum.failed += r.failed; sum.skipped += r.skipped;
    console.log(`  batch ${i + 1}: sent ${r.sent}, failed ${r.failed}, passed over ${r.skipped}, ${r.remaining} to go`);
    if (r.done) break;
  }
  console.log(`\n  finished: ${sum.sent} sent, ${sum.failed} failed, ${sum.skipped} passed over`);
}
process.exit(0);
