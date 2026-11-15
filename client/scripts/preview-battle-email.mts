/** Prints the battle email as plain text, so the wording can be read before anything is sent. */
process.loadEnvFile(".env");
const { battleOpenEmail } = await import("../lib/email.ts");
const t = battleOpenEmail({
  songs: [{ title: "Shaker Heights", artistName: "Hero in Eden", url: "https://app.musicontherox.com/battles?b=EXAMPLE" }],
  unsubscribeUrl: "https://example.invalid",
});
console.log("SUBJECT: " + t.subject + "\n");
console.log(
  t.html
    .replace(/<br\/?>/g, "\n")
    .replace(/<\/p>|<\/h1>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
);
