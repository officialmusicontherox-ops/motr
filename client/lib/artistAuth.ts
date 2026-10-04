import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

/**
 * Signed session for an artist looking at their own page.
 *
 * Its own cookie and its own token table, like the scout session. The point
 * of keeping them apart is that no endpoint has to remember which kind of
 * account it is talking to: an artist route asks for an artist session and
 * can get nothing else, so there is no path by which one becomes the other.
 *
 * The artist id never travels in a URL. Every query the page makes is scoped
 * to the id read out of this cookie server-side, which is what makes it
 * impossible to ask for somebody else's numbers: the request never names
 * whose numbers it wants.
 */

const COOKIE_NAME = "artist_session";
// Longer than a scout's fortnight. This session only ever reveals an artist's
// own tracks, and an artist who has to request a fresh link every time they
// want to post is an artist who stops posting.
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", `artist:${secret()}`).update(payload).digest("hex");
}

export async function createArtistSession(artistId: string) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${artistId}.${expiresAt}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearArtistSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** The artist id if the request carries a valid, unexpired session. */
export async function getArtistSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [artistId, expiresAtStr, signature] = parts;
  const expected = sign(`${artistId}.${expiresAtStr}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expiresAtStr) < Date.now()) return null;

  return artistId;
}

/** The artist this request may act as, or a refusal to hand back as-is. */
export async function requireArtist(): Promise<
  | { ok: true; artistId: string; name: string; email: string }
  | { ok: false; status: number; error: string }
> {
  const artistId = await getArtistSession();
  if (!artistId) return { ok: false, status: 401, error: "Sign in again to continue." };

  const artist = await prisma.artist.findUnique({
    where: { id: artistId },
    select: { id: true, name: true, email: true },
  });
  if (!artist) return { ok: false, status: 401, error: "Sign in again to continue." };

  return { ok: true, artistId: artist.id, name: artist.name, email: artist.email };
}
