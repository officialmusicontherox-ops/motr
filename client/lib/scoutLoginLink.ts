import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * Sign-in links for the A&R portal.
 *
 * Magic links rather than passwords for the same reason as curators: every
 * account is created by hand here, so opening the inbox really is proof of
 * identity — nobody can invent an account to receive a link for.
 */

const TTL_MINUTES = 15;
const MAX_PER_EMAIL_PER_HOUR = 4;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export type ScoutLinkResult =
  | { ok: true; token: string; email: string; name: string }
  | { ok: false; reason: "unknown" | "inactive" | "throttled" };

export async function createScoutLoginToken(rawEmail: string): Promise<ScoutLinkResult> {
  const email = rawEmail.trim().toLowerCase();

  const scout = await prisma.scout.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { email: true, name: true, status: true },
  });

  // "unknown" and "inactive" are both reported to the caller as the same
  // neutral message — a sign-in form that confirms which addresses exist is
  // a list of your customers for anyone who asks politely.
  if (!scout) return { ok: false, reason: "unknown" };
  if (scout.status !== "ACTIVE") return { ok: false, reason: "inactive" };

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.scoutLoginToken.count({
    where: { email, createdAt: { gte: hourAgo } },
  });
  if (recent >= MAX_PER_EMAIL_PER_HOUR) return { ok: false, reason: "throttled" };

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.scoutLoginToken.create({
    data: {
      email,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
    },
  });

  return { ok: true, token, email: scout.email, name: scout.name };
}

/** Reads a token without spending it — see curatorLoginLink for why. */
export async function peekScoutToken(token: string) {
  if (!token) return null;
  const row = await prisma.scoutLoginToken.findUnique({
    where: { tokenHash: hash(token) },
    select: { email: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/** Spends the token and returns the scout id, or null if it was already used. */
export async function consumeScoutToken(token: string): Promise<string | null> {
  if (!token) return null;
  const tokenHash = hash(token);

  const claimed = await prisma.scoutLoginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gte: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  const row = await prisma.scoutLoginToken.findUnique({
    where: { tokenHash },
    select: { email: true },
  });
  if (!row) return null;

  // Signing in retires every other outstanding link for that address.
  await prisma.scoutLoginToken.updateMany({
    where: { email: row.email, usedAt: null },
    data: { usedAt: new Date() },
  });

  const scout = await prisma.scout.findFirst({
    where: { email: { equals: row.email, mode: "insensitive" }, status: "ACTIVE" },
    select: { id: true },
  });
  if (!scout) return null;

  await prisma.scout.update({ where: { id: scout.id }, data: { lastSeenAt: new Date() } });
  return scout.id;
}
