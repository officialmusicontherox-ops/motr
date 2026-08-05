import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Wakes the database.
 *
 * Neon suspends the compute when idle, so the first query after a quiet
 * spell pays roughly 1.5s to start it — which lands on whoever arrives
 * first, at the exact moment they tap to begin. The sign-in screen calls
 * this on load, so the wake-up happens while they read rather than while
 * they wait.
 *
 * Deliberately the cheapest query there is: it runs on every visit, and its
 * only job is to make the connection exist.
 */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ms: Date.now() - started });
  } catch {
    // A failure costs nothing — the real request will report it.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
