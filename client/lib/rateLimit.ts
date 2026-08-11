import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { clientIp } from "./loginThrottle";

/**
 * Rate limiting for the public endpoints.
 *
 * Only the admin login had any. Everything else was open, which matters most
 * for two of them: the one that adds tracks to the feed and emails the
 * operator on every call, and the one that creates anonymous listeners —
 * which is the cheapest route to manufacturing votes on a platform whose
 * whole claim is that the vote can't be bought.
 *
 * Limits are set to sit far above real use and far below scripted abuse. An
 * artist sending two batches of five songs is normal; two hundred submissions
 * from one address in an hour is not.
 *
 * State lives in Postgres because serverless functions don't share memory —
 * an in-process counter resets on every cold start and stops nothing.
 */

export const LIMITS = {
  /** Two full batches of five, plus retries. */
  ingest: { max: 20, windowMs: 60 * 60 * 1000 },
  /** Generous: shared office and mobile-carrier addresses are one IP. */
  fanCreate: { max: 30, windowMs: 60 * 60 * 1000 },
  curatorApply: { max: 5, windowMs: 24 * 60 * 60 * 1000 },
  errorReport: { max: 40, windowMs: 60 * 60 * 1000 },
  summary: { max: 20, windowMs: 60 * 60 * 1000 },
} as const;

export type LimitName = keyof typeof LIMITS;

/**
 * Records a hit and says whether it was allowed.
 *
 * Counted before inserting, so the limit is the number of *successful*
 * attempts in the window rather than that plus one.
 */
export async function allowRequest(
  name: LimitName,
  req: NextRequest
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const { max, windowMs } = LIMITS[name];
  const bucket = `${name}:${clientIp(req)}`;
  const since = new Date(Date.now() - windowMs);

  try {
    const used = await prisma.requestHit.count({ where: { bucket, createdAt: { gte: since } } });

    if (used >= max) {
      const oldest = await prisma.requestHit.findFirst({
        where: { bucket, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const freesAt = (oldest?.createdAt.getTime() ?? Date.now()) + windowMs;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((freesAt - Date.now()) / 1000)),
      };
    }

    await prisma.requestHit.create({ data: { bucket } });

    // Opportunistic cleanup, so there's no schedule to forget. Cheap because
    // it only ever touches rows already outside every window.
    if (Math.floor(Date.now() / 1000) % 50 === 0) {
      await prisma.requestHit
        .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 25 * 60 * 60 * 1000) } } })
        .catch(() => {});
    }

    return { allowed: true };
  } catch {
    // A limiter that fails closed would take the whole submission form down
    // with it. Availability wins over rate limiting here.
    return { allowed: true };
  }
}

/** The 429 to return when a limit is hit. */
export function tooManyRequests(retryAfterSeconds: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } }
  );
}
