import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * Sign-in links for listeners, for anyone without a Google account.
 *
 * The same shape as the artist link: single use, thirty minutes, stored only
 * as a hash, and spent by a button on the page it opens rather than by the
 * click itself, so a mail scanner that opens every link cannot use it up.
 *
 * Unlike the artist link, any address may ask. The listener account is
 * found or made when the link is used, which is what proves the address is
 * theirs.
 */
const TTL_MINUTES = 30;
const MAX_PER_EMAIL_PER_HOUR = 4;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const FAN_LINK_MINUTES = TTL_MINUTES;

export async function createFanLoginToken(
  rawEmail: string
): Promise<{ ok: true; token: string; email: string } | { ok: false; reason: "throttled" }> {
  const email = rawEmail.trim().toLowerCase();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.fanLoginToken.count({ where: { email, createdAt: { gte: hourAgo } } });
  if (recent >= MAX_PER_EMAIL_PER_HOUR) return { ok: false, reason: "throttled" };

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.fanLoginToken.create({
    data: { email, tokenHash: hash(token), expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000) },
  });
  return { ok: true, token, email };
}

/** Whether a link is still good, without spending it. */
export async function peekFanToken(token: string) {
  if (!token) return null;
  const row = await prisma.fanLoginToken.findUnique({
    where: { tokenHash: hash(token) },
    select: { email: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/** Spends a link and returns its address, or null if it was used or expired. */
export async function consumeFanToken(token: string): Promise<string | null> {
  if (!token) return null;
  const tokenHash = hash(token);
  // The condition is in the WHERE, so two clicks together cannot both pass.
  const claimed = await prisma.fanLoginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gte: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;
  const row = await prisma.fanLoginToken.findUnique({ where: { tokenHash }, select: { email: true } });
  return row?.email ?? null;
}
