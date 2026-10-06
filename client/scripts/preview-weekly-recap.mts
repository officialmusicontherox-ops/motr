/** What the Sunday recap would send. Sends nothing. */
import { recapsFor, recapDue, RECAP_START } from "../lib/weeklyRecap";
import { lastCompleteWeek } from "../lib/weekWindow";
import { weeklyRecapEmail } from "../lib/email";

const week = lastCompleteWeek();
const state = recapDue();
console.log(`last complete week : ${week.label}`);
console.log(`starts             : ${RECAP_START.toISOString().slice(0, 10)}`);
console.log(`due right now      : ${state.due ? "YES" : "no — " + state.why}\n`);

const recaps = await recapsFor(week);
if (recaps.length === 0) {
  console.log("Nobody had a save that week, so nobody would be written to.");
  process.exit(0);
}

const placed = recaps.filter((r) => r.position);
const rest = recaps.filter((r) => !r.position);
console.log(`${recaps.length} artists would be written to: ${placed.length} placed, ${rest.length} told their own number\n`);

for (const r of recaps.slice(0, 14)) {
  const mail = weeklyRecapEmail({
    name: r.name, week: week.label, position: r.position,
    saves: r.saves, trackTitle: r.track?.title ?? null,
  });
  console.log(`  ${(r.position ? "#" + r.position : " -").padStart(3)}  ${r.name.slice(0, 22).padEnd(24)} ${r.saves} saves  card=${r.position ? (r.track ? "yes" : "no track") : "none"}`);
  console.log(`        subject: ${mail.subject}`);
}
