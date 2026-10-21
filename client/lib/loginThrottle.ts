import { NextRequest } from "next/server";
import { prisma } from "./prisma";

/**
 * Throttling for the admin login.
 *
 * The credentials themselves are strong — bcrypt plus a TOTP code — but
 * without a limit an attacker can simply keep guessing. Six digits is a
 * million combinations, which is minutes of work at unlimited request rates,
 * so the rate limit is what actually protects the second factor.
 *
 * Two independent limits, because they catch different attacks:
 *  - per IP, which stops one machine grinding through guesses
 *  - per account, which stops a distributed attempt spread across many IPs
 *
 * State lives in Postgres because serverless functions don't share memory —
 * an in-process counter would reset on every cold start and stop nothing.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_PER_ACCOUNT = 10;

export type ThrottleResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; reason: "ip" | "account" };

/**
 * The client's real address. Vercel sits in front of the app, so the socket
 * address is theirs, not the visitor's — x-forwarded-for is the one that
 * carries the original and its first entry is the client.
 */
export function clientIp(req: NextRequest): string {
  /**
   * The last entry, not the first.
   *
   * x-forwarded-for is built left to right as a request crosses proxies, so
   * the leftmost value is whatever the caller put there and the rightmost is
   * what our own edge appended. Reading the first entry meant anyone could
   * name their own address: a forged header was recorded verbatim, which
   * made every limit keyed on it meaningless. The fan-creation gate is the
   * one that mattered, because it exists to stop listeners being
   * manufactured to inflate saves.
   *
   * Taking the last entry is right whether the edge appends to the header or
   * replaces it, which is why it is preferred over trusting a platform
   * header name from memory.
   */
  const nf = req.headers.get("x-nf-client-connection-ip");
  if (nf) return nf.trim();

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }

  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function checkLoginThrottle(
  ip: string,
  email: string
): Promise<ThrottleResult> {
  const since = new Date(Date.now() - WINDOW_MS);

  const [ipFails, accountFails] = await Promise.all([
    prisma.adminLoginAttempt.count({
      where: { ip, success: false, createdAt: { gte: since } },
    }),
    prisma.adminLoginAttempt.count({
      where: { email, success: false, createdAt: { gte: since } },
    }),
  ]);

  if (ipFails >= MAX_PER_IP) {
    return { allowed: false, retryAfterSeconds: WINDOW_MS / 1000, reason: "ip" };
  }
  if (accountFails >= MAX_PER_ACCOUNT) {
    return { allowed: false, retryAfterSeconds: WINDOW_MS / 1000, reason: "account" };
  }
  return { allowed: true };
}

export async function recordLoginAttempt(params: {
  ip: string;
  email: string;
  success: boolean;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.adminLoginAttempt.create({
      data: {
        ip: params.ip.slice(0, 100),
        email: params.email.slice(0, 200),
        success: params.success,
        userAgent: params.userAgent?.slice(0, 300) ?? null,
      },
    });

    // A successful sign-in clears the slate, so a legitimate admin who
    // fumbled their code a few times isn't left locked out afterwards.
    if (params.success) {
      await prisma.adminLoginAttempt.deleteMany({
        where: { OR: [{ ip: params.ip }, { email: params.email }], success: false },
      });
    }
  } catch {
    // Never let bookkeeping block a legitimate sign-in.
  }
}

/** Keeps the table small; 30 days is plenty for reviewing suspicious activity. */
export async function pruneLoginAttempts(): Promise<void> {
  try {
    await prisma.adminLoginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });
  } catch {
    // Non-critical.
  }
}
