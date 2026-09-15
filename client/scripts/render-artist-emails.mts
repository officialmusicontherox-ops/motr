/** Prints the artist emails as plain text so the copy can be read before sending. */
import { submitMoreMusicEmail, submissionReceivedEmail } from "../lib/email";

const strip = (h: string) =>
  h.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").trim();

const a = submitMoreMusicEmail({
  name: "Trapper Walther", tracks: 3, saves: 41,
  appUrl: "https://app.musicontherox.com",
  unsubscribeUrl: "https://app.musicontherox.com/unsubscribe?artist=x&t=y",
});
console.log("=".repeat(60) + "\nCOME BACK / SEND MORE MUSIC\nSUBJECT: " + a.subject + "\n" + "-".repeat(60));
console.log(strip(a.html));
