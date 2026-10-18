import type { Config } from "@netlify/functions";

/**
 * Wakes the app every twenty minutes to send share pages to artists who have
 * not had one. A thin caller: the rules live in the app, not here.
 */
export default async () => {
  const base = process.env.APP_URL ?? "https://app.musicontherox.com";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.log("CRON_SECRET is not set; nothing to do.");
    return;
  }

  const res = await fetch(`${base}/api/cron/artist-share`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
  console.log(`artist share pages: ${res.status} ${await res.text()}`);
};

// Hourly, not every twenty minutes.
//
// Neon suspends the database when it is idle and bills for the time it is
// awake, so what costs money is how often something wakes it, not how much
// work it then does. A thousand runs had sent ninety-four cards, about eleven
// runs for each one.
//
// The minute is shared with the other schedules on purpose: three crons on
// the same minute wake the database once between them, where three on
// different minutes wake it three times. The cost of this is that a card can
// now take up to an hour instead of twenty minutes.
export const config: Config = { schedule: "7 * * * *" };
