/** Sanity-checks the A&R queries against real data. Read-only. */
import { scoutCatalogue, scoutSummary } from "../lib/scoutData";

const summary = await scoutSummary();
console.log("SUMMARY:", JSON.stringify(summary, null, 1));

const tracks = await scoutCatalogue({ sort: "swipes", limit: 5 });
console.log(`\nTOP ${tracks.length} BY VERDICTS:`);
for (const t of tracks) {
  console.log(
    `  ${t.title} — ${t.artistName}\n` +
      `    verdicts ${t.totalSwipes}  saves ${t.rightSwipes}  ` +
      `saveRate ${t.saveRate === null ? "too early" : Math.round(t.saveRate * 100) + "%"}  ` +
      `heardOut ${t.fullListenRate === null ? "—" : Math.round(t.fullListenRate * 100) + "%"}  ` +
      `decisionAt ${t.medianDecisionMs === null ? "—" : (t.medianDecisionMs / 1000).toFixed(1) + "s"}\n` +
      `    countries ${JSON.stringify(t.topCountries)}  regions ${JSON.stringify(t.topRegions)}`
  );
}
