import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Signed session for a listener.
 *
 * Before this, a fan id was the credential: anything holding one could read
 * that person's saved tracks and badges by naming them in a query string.
 * Ids are not secrets — they travelled in the Google sign-in redirect and so
 * into browser history, in every fetch URL and so into any log along the way,
 * and for one afternoon in links people were encouraged to post publicly.
 *
 * The id now rides in an httpOnly cookie instead. A listener's own requests
 * no longer name whose data they want, which is what makes it impossible to
 * ask for somebody else's.
 *
 * Same shape as the artist session deliberately: same secret derivation, same
 * signing, same constant-time compare. One pattern to get right rather than
 * two to keep in step.
 */

const COOKIE_NAME = "fan_session";
// A listener who loses this loses their saves and their badges, which is the
// whole reason they stay. Long, and refreshed whenever they return.
const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", `fan:${secret()}`).update(payload).digest("hex");
}

export async function createFanSession(fanId: string): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${fanId}.${expiresAt}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearFanSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** The fan id if the request carries a valid, unexpired session. */
export async function getFanSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [fanId, expiresAtStr, signature] = parts;
  const expected = sign(`${fanId}.${expiresAtStr}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expiresAtStr) < Date.now()) return null;

  return fanId;
}
