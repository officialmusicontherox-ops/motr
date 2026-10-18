import type { Config } from "@netlify/functions";

/**
 * Wakes the app up every five minutes to tell artists why a submission failed.
 *
 * A thin caller rather than the logic itself: everything it needs already runs
 * inside the app, and reimplementing it here would mean two copies of the same
 * rules drifting apart.
 */
export default async () => {
  const base = process.env.APP_URL ?? "https://app.musicontherox.com";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.log("CRON_SECRET is not set; nothing to do.");
    return;
  }

  const res = await fetch(`${base}/api/cron/refusal-follow-up`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
  console.log(`refusal follow-up: ${res.status} ${await res.text()}`);
};

// Every three hours, not every five minutes.
//
// This had run 21,312 times to deal with 68 refusals, roughly 313 runs for
// each one, and at one run every five minutes it alone kept the database
// awake around the clock: Neon suspends after five minutes idle, so nothing
// on a five-minute schedule ever lets it sleep.
//
// Refusals arrive about once a day. Help arriving within a few hours rather
// than within five minutes is a fair trade for a database that is asleep most
// of the time, and the minute matches artist-share so they share a wake.
export const config: Config = { schedule: "7 */3 * * *" };
