import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * Sign-in by emailed link, for curators whose address isn't a Google account.
 *
 * Two of the first four were in that position — a radio show on Hostinger and
 * a blog on SiteGround — and both were approved and then locked out. Adding
 * Microsoft wouldn't have helped either of them; an emailed link works for
 * every address regardless of who runs the mail.
 *
 * There's no password because opening the inbox is the proof, and that holds
 * here in a way it wouldn't for public signup: every curator address is
 * approved by hand before it can ever be used, so an attacker can't invent an
 * account to receive a link for.
 */

/** Long enough to find the email, short enough that a forwarded one is dead. */
const TTL_MINUTES = 15;

/** Per address, so nobody's inbox can be used as a weapon. */
const MAX_PER_EMAIL_PER_HOUR = 4;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export type RequestResult =
  | { ok: true; token: string; email: string }
  | { ok: false; reason: "unknown" | "inactive" | "throttled" };

/**
 * Issues a link for an approved, active curator.
 *
 * Returns the raw token exactly once, to be emailed. Only its hash is stored,
 * so nothing that can sign in survives in the database.
 */
export async function createLoginToken(rawEmail: string): Promise<RequestResult> {
  const email = rawEmail.trim().toLowerCase();

  const curator = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { email: true, status: true },
  });

  if (!curator) return { ok: false, reason: "unknown" };
  if (curator.status === "SUSPENDED" || curator.status === "REMOVED") {
    return { ok: false, reason: "inactive" };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.curatorLoginToken.count({
    where: { email, createdAt: { gte: hourAgo } },
  });
  if (recent >= MAX_PER_EMAIL_PER_HOUR) return { ok: false, reason: "throttled" };

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.curatorLoginToken.create({
    data: {
      email,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
    },
  });

  return { ok: true, token, email: curator.email };
}

/**
 * Reads a token without consuming it.
 *
 * The link opens a page with a button rather than signing someone in on
 * sight, because corporate mail scanners follow links in messages before the
 * recipient ever sees them. A one-time token that signs in on GET is burned
 * by the scanner, and the curator gets "this link has expired" on their first
 * and only click — which looks exactly like a broken product.
 */
export async function peekLoginToken(token: string) {
  if (!token) return null;
  const row = await prisma.curatorLoginToken.findUnique({
    where: { tokenHash: hash(token) },
    select: { email: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/**
 * Spends the token and says who it belonged to.
 *
 * The update is conditional on the row still being unused, so two clicks
 * arriving together can't both succeed — whichever loses the race gets null
 * rather than a second session.
 */
export async function consumeLoginToken(token: string): Promise<string | null> {
  if (!token) return null;
  const tokenHash = hash(token);

  const claimed = await prisma.curatorLoginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gte: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  const row = await prisma.curatorLoginToken.findUnique({
    where: { tokenHash },
    select: { email: true },
  });
  if (!row) return null;

  // Signing in retires every other outstanding link for that address, so an
  // older email sitting in the inbox stops being a way in.
  await prisma.curatorLoginToken
    .updateMany({
      where: { email: row.email, usedAt: null },
      data: { usedAt: new Date() },
    })
    .catch(() => {});

  // Housekeeping, cheap and without a schedule to forget.
  await prisma.curatorLoginToken
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch(() => {});

  return row.email;
}
