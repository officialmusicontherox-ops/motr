/**
 * Shows which artists would get a progress email, without sending anything.
 *
 *   DATABASE_URL="$NEON" npx tsx scripts/preview-milestones.mts
 */
import { pendingMilestones } from "../lib/artistMilestones";

const due = await pendingMilestones();
console.log(`artists due: ${due.length}`);
console.log(`tracks:      ${due.reduce((n, r) => n + r.tracks.length, 0)}`);
for (const r of due) {
  console.log(`\n  ${r.artistName}  <${r.email.replace(/(.{2}).*(@.*)/, "$1***$2")}>`);
  for (const t of r.tracks) {
    console.log(
      `    ${String(t.rightSwipes).padStart(4)} right swipes  (milestone ${t.milestone})  ${t.title}`
    );
  }
}
