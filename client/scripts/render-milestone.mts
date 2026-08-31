/** Prints the artist milestone email as plain text, so it can be read before sending. */
import { trackMilestoneEmail } from "../lib/email";

const e = trackMilestoneEmail({
  artistName: "Loveless & Company",
  tracks: [
    { title: "I'm Done", rightSwipes: 3, milestone: 1 },
    { title: "Rich Man", rightSwipes: 2, milestone: 1 },
    { title: "Bonnie And Clyde", rightSwipes: 2, milestone: 1 },
  ],
  appUrl: "https://app.musicontherox.com",
  unsubscribeUrl: "https://app.musicontherox.com/unsubscribe?artist=x&t=y",
});
console.log("SUBJECT: " + e.subject + "\n");
console.log(e.html.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").trim());
