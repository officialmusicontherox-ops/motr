import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Signed session for a curator.
 *
 * Until this existed, every curator endpoint took the curator's id straight
 * out of the request body and trusted it. That id is not a secret: it is
 * handed to the browser in a redirect URL after Google sign-in, so it lands
 * in history, in referrer headers, and in any screenshot of the address bar.
 *
 * Anyone holding one could act as that curator — pass on a track, claim a
 * share, or, worst of all, POST a withdrawal with their own PayPal address in
 * it, because the payout destination was accepted from the same untrusted
 * body. Nobody has a balance yet, which is the only reason that wasn't a
 * theft. The identity now has to be proved with a signed httpOnly cookie the
 * browser can't read and a caller can't forge.
 */

const COOKIE_NAME = "curator_session";
export const CURATOR_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — curating is occasional
const SESSION_TTL_MS = CURATOR_SESSION_TTL_MS;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

/** For the OAuth callback, which sets the cookie on its own redirect. */
export function signCuratorPayload(payload: string): string {
  return sign(payload);
}

export async function createCuratorSession(userId: string) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearCuratorSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** The curator id if the request carries a valid, unexpired session. */
export async function getCuratorSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, expiresAtStr, signature] = parts;
  const expected = sign(`${userId}.${expiresAtStr}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  if (Number(expiresAtStr) < Date.now()) return null;
  return userId;
}

/**
 * The curator this request is allowed to act as.
 *
 * A body may still carry a userId — the client has always sent one — but it
 * is only honoured when it matches the session. Mismatches are refused rather
 * than silently substituted, so a bug in the client surfaces instead of
 * quietly acting as the wrong person.
 */
export async function requireCurator(claimedUserId?: unknown): Promise<
  { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
  const userId = await getCuratorSession();
  if (!userId) {
    return { ok: false, status: 401, error: "Sign in again to continue." };
  }
  if (typeof claimedUserId === "string" && claimedUserId && claimedUserId !== userId) {
    return { ok: false, status: 403, error: "That isn't your account." };
  }
  return { ok: true, userId };
}
