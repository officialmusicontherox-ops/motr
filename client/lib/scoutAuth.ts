import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

/**
 * Signed session for an A&R account.
 *
 * Deliberately its own cookie and its own table rather than a role bolted
 * onto the curator session. A curator judges tracks and is owed money; a
 * scout only ever reads. Keeping them apart means no curator endpoint has to
 * remember to exclude scouts, and a bug in one can't grant the other.
 */

const COOKIE_NAME = "scout_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — shorter than a curator's; this one sees everything

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", `scout:${secret()}`).update(payload).digest("hex");
}

export async function createScoutSession(scoutId: string) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${scoutId}.${expiresAt}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearScoutSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** The scout id if the request carries a valid, unexpired session. */
export async function getScoutSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [scoutId, expiresAtStr, signature] = parts;
  const expected = sign(`${scoutId}.${expiresAtStr}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expiresAtStr) < Date.now()) return null;

  return scoutId;
}

/**
 * The scout this request is allowed to act as, refusing suspended accounts.
 *
 * Status is checked on every request rather than only at sign-in: a session
 * lasts a fortnight, and revoking access has to take effect when you revoke
 * it, not whenever the cookie happens to expire.
 */
export async function requireScout(): Promise<
  { ok: true; scoutId: string; name: string } | { ok: false; status: number; error: string }
> {
  const scoutId = await getScoutSession();
  if (!scoutId) return { ok: false, status: 401, error: "Sign in again to continue." };

  const scout = await prisma.scout.findUnique({
    where: { id: scoutId },
    select: { id: true, name: true, status: true },
  });
  if (!scout) return { ok: false, status: 401, error: "Sign in again to continue." };
  if (scout.status !== "ACTIVE") {
    return { ok: false, status: 403, error: "This account is no longer active." };
  }

  return { ok: true, scoutId: scout.id, name: scout.name };
}
