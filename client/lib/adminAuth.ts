import crypto from "crypto";
import { cookies } from "next/headers";
import { verify as verifyOtp } from "otplib";

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  try {
    const result = await verifyOtp({ secret, token });
    return result.valid;
  } catch {
    return false;
  }
}

const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export async function createAdminSession(adminId: string) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${adminId}.${expiresAt}`;
  const token = `${payload}.${sign(payload)}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Returns the admin id if the request carries a valid, unexpired session
// cookie signed with our secret — otherwise null. Constant-time signature
// compare to avoid timing attacks on the HMAC.
export async function getAdminSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [adminId, expiresAtStr, signature] = parts;
  const payload = `${adminId}.${expiresAtStr}`;
  const expected = sign(payload);

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return adminId;
}
