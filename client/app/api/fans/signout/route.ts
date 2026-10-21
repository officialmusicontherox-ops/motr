import { NextResponse } from "next/server";
import { clearFanSession } from "@/lib/fanAuth";

/**
 * Ends a listener's session.
 *
 * Signing out used to clear localStorage and nothing else, which was enough
 * when the id in localStorage was the only thing identifying anyone. It is
 * not enough now: the session lives in an httpOnly cookie that the page
 * cannot touch, so without this it survived a sign-out and the next person
 * on a shared computer inherited it.
 */
export async function POST() {
  await clearFanSession();
  return NextResponse.json({ ok: true });
}
