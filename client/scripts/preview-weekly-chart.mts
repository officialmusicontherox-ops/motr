/** What the weekly chart email would say and who would get it. Sends nothing. */
import { previewWeeklyChart } from "../lib/weeklyChart";
import { weeklyChartEmail } from "../lib/email";

const p = await previewWeeklyChart("https://app.musicontherox.com");
console.log(`recipients: ${p.recipients}\n`);

const e = weeklyChartEmail({
  name: "Jerrett",
  songs: p.songs,
  artists: p.artists,
  unsubscribeUrl: "https://app.musicontherox.com/unsubscribe?fan=x&t=y",
});
console.log("SUBJECT: " + e.subject + "\n");
console.log(e.html.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").trim());
