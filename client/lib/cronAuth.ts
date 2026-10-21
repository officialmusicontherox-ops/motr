import crypto from "crypto";

/**
 * Checks the shared secret a scheduled job presents.
 *
 * Compared in constant time. A plain !== returns as soon as two bytes
 * differ, which leaks how much of a guess was right. Over the internet that
 * signal is buried in jitter, so this is hardening rather than a hole being
 * closed, but there is no reason to compare a secret the careless way.
 */
export function cronSecretOk(presented: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !presented) return false;

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
