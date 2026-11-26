import { NextRequest, NextResponse } from "next/server";
import { consumeFanToken } from "@/lib/fanLoginLink";
import { signInFan } from "@/lib/fanSignIn";
import { fanSessionCookie, getFanSession } from "@/lib/fanAuth";
import { allowRequest } from "@/lib/rateLimit";
import { safeNext, withSignedIn } from "@/lib/safeNext";

/** Spends a listener's sign-in link and signs them in. Called by the button on /signin/verify. */
export async function POST(req: NextRequest) {
  const gate = await allowRequest("signInLink", req);
  if (!gate.allowed) {
    return NextResponse.json({ error: "Too many tries. Wait a moment and try again." }, { status: 429 });
  }

  const { token, next } = await req.json().catch(() => ({}));
  const email = await consumeFanToken(typeof token === "string" ? token : "");
  if (!email) {
    return NextResponse.json(
      { error: "That link has expired or was already used. Ask for a new one." },
      { status: 400 }
    );
  }

  const fan = await signInFan(email, undefined, (await getFanSession()) ?? undefined);
  const res = NextResponse.json({ ok: true, next: withSignedIn(safeNext(next)) });
  const session = fanSessionCookie(fan.id);
  res.cookies.set(session.name, session.value, session.options);
  return res;
}
