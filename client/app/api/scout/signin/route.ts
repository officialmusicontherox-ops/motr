import { NextRequest, NextResponse } from "next/server";
import { createScoutLoginToken } from "@/lib/scoutLoginLink";
import { allowRequest } from "@/lib/rateLimit";
import { sendEmail, scoutLoginLinkEmail } from "@/lib/email";

/**
 * Requests a sign-in link for the A&R portal.
 *
 * Always answers the same way. An unknown address, a suspended account and a
 * real one are indistinguishable from outside — otherwise this form is a way
 * to enumerate which labels MOTR is talking to.
 */
export async function POST(req: NextRequest) {
  const gate = await allowRequest("signInLink", req);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly.", retryAfterSeconds: gate.retryAfterSeconds },
      { status: 429 }
    );
  }

  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Enter the email address you were given access with." }, { status: 400 });
  }

  const result = await createScoutLoginToken(email);
  if (result.ok) {
    const appUrl = process.env.APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    await sendEmail(
      result.email,
      scoutLoginLinkEmail({
        name: result.name,
        url: `${appUrl}/scout/verify?token=${encodeURIComponent(result.token)}`,
        minutes: 15,
      })
    );
  }

  return NextResponse.json({ ok: true });
}
