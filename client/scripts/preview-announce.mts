import { whatMotrIsEmail } from "../lib/email";
const e = whatMotrIsEmail({ unsubscribeUrl: "https://app.musicontherox.com/unsubscribe?fan=x&t=y" });
console.log("SUBJECT: " + e.subject + "\n");
console.log(e.html.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").trim());
