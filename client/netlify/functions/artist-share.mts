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

export const config: Config = { schedule: "*/20 * * * *" };
