import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * Sign-in links for an artist's own page.
 *
 * A link rather than a password, for the same reason as the scout portal: an
 * artist never chose a password here, and the address they submitted with is
 * the one thing they can prove they control. Opening the inbox is the proof.
 *
 * Unlike the scout portal, anybody at all can type an address into this form,
 * so every outcome below is reported to the caller as the same sentence. A
 * form that says "no artist with that address" is a way to find out who has
 * submitted music, one guess at a time.
 */

const TTL_MINUTES = 30;
const MAX_PER_EMAIL_PER_HOUR = 4;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export type ArtistLinkResult =
  | { ok: true; token: string; email: string; name: string }
  | { ok: false; reason: "unknown" | "no-tracks" | "throttled" };

export async function createArtistLoginToken(rawEmail: string): Promise<ArtistLinkResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return { ok: false, reason: "unknown" };

  const artist = await prisma.artist.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { email: true, name: true, _count: { select: { tracks: true } } },
  });

  if (!artist) return { ok: false, reason: "unknown" };
  // Nothing to show yet. Still answered with the same neutral sentence, so
  // this doesn't become a way to test which addresses are in the system.
  if (artist._count.tracks === 0) return { ok: false, reason: "no-tracks" };

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.artistLoginToken.count({
    where: { email, createdAt: { gte: hourAgo } },
  });
  if (recent >= MAX_PER_EMAIL_PER_HOUR) return { ok: false, reason: "throttled" };

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.artistLoginToken.create({
    data: {
      email,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
    },
  });

  return { ok: true, token, email: artist.email, name: artist.name };
}

/**
 * Reads a token without spending it.
 *
 * A link that signs you in the moment it is fetched is a link that corporate
 * mail scanners destroy before the artist ever clicks it: the scanner follows
 * every URL in the message, burns the single use, and the real person arrives
 * to be told their link was already used. So the landing page only looks, and
 * a button the artist presses does the spending.
 */
export async function peekArtistToken(token: string) {
  if (!token) return null;
  const row = await prisma.artistLoginToken.findUnique({
    where: { tokenHash: hash(token) },
    select: { email: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/** Spends the token and returns the artist id, or null if it was already used. */
export async function consumeArtistToken(token: string): Promise<string | null> {
  if (!token) return null;
  const tokenHash = hash(token);

  // Claimed with the condition in the WHERE rather than by reading then
  // writing, so two clicks arriving together can't both succeed.
  const claimed = await prisma.artistLoginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gte: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  const row = await prisma.artistLoginToken.findUnique({
    where: { tokenHash },
    select: { email: true },
  });
  if (!row) return null;

  // Signing in retires every other outstanding link for that address, so an
  // older email lying around in an inbox stops being a way in.
  await prisma.artistLoginToken.updateMany({
    where: { email: row.email, usedAt: null },
    data: { usedAt: new Date() },
  });

  const artist = await prisma.artist.findFirst({
    where: { email: { equals: row.email, mode: "insensitive" } },
    select: { id: true },
  });
  return artist?.id ?? null;
}
