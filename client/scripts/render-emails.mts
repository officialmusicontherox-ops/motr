/** Prints every email an artist or listener receives, as plain text. */
import {
  trackBrokeThroughEmail, submissionReceivedEmail, trackMilestoneEmail, comeBackEmail,
} from "../lib/email";

const strip = (h: string) =>
  h.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").trim();

const show = (name: string, e: { subject: string; html: string }) =>
  console.log(`\n${"=".repeat(62)}\n${name}\nSUBJECT: ${e.subject}\n${"-".repeat(62)}\n${strip(e.html)}`);

show("WHEN A TRACK BREAKS THROUGH", trackBrokeThroughEmail({
  trackTitle: "I Get Flustered", artistName: "Trapper Walther",
  approvals: 31, approvalRate: 0.62, trackId: "abc123",
}));

show("WHEN A TRACK IS SUBMITTED", submissionReceivedEmail({
  tracks: [{ id: "abc123", title: "I Get Flustered", artistName: "Trapper Walther" }],
  requiredVotes: 75, requiredRate: 0.33,
}));

show("MILESTONE UPDATE", trackMilestoneEmail({
  artistName: "Trapper Walther",
  tracks: [{ title: "I Get Flustered", rightSwipes: 12, milestone: 10 }],
  appUrl: "https://app.musicontherox.com",
  unsubscribeUrl: "https://app.musicontherox.com/unsubscribe?artist=x&t=y",
}));
