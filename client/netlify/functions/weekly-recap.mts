import type { Config } from "@netlify/functions";

/**
 * Wakes the app every hour on Sunday to send the weekly recap.
 *
 * Hourly rather than at one fixed time because the send belongs at 10am
 * Central and a single UTC hour would drift when the clocks change. The app
 * decides whether this is the hour; every other call does nothing.
 */
export default async () => {
  const base = process.env.APP_URL ?? "https://app.musicontherox.com";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.log("CRON_SECRET is not set; nothing to do.");
    return;
  }
  const res = await fetch(`${base}/api/cron/weekly-recap`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
  console.log(`weekly recap: ${res.status} ${await res.text()}`);
};

// Still hourly on Sundays, but on the same minute as the other schedules so
// it wakes the database alongside them rather than on its own.
export const config: Config = { schedule: "7 * * * 0" };
