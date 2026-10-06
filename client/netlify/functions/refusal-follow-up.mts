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

export const config: Config = { schedule: "*/5 * * * *" };
