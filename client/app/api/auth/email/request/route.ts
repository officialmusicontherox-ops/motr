import { NextRequest, NextResponse } from "next/server";
import { allowRequest } from "@/lib/rateLimit";
import { createFanLoginToken, FAN_LINK_MINUTES } from "@/lib/fanLoginLink";
import { sendEmail, fanLoginLinkEmail } from "@/lib/email";
import { isEmailAddress } from "@/lib/emailAddress";
import { safeNext } from "@/lib/safeNext";
import { APP_URL } from "@/lib/appUrl";

/**
 * Emails a listener a sign-in link, for anyone without a Google account.
 *
 * Always answers the same way once the address looks like one, so the box
 * cannot be used to find out who has an account.
 */
export async function POST(req: NextRequest) {
  const gate = await allowRequest("signInLink", req);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly.", retryAfterSeconds: gate.retryAfterSeconds },
      { status: 429 }
    );
  }

  const { email, next } = await req.json().catch(() => ({}));
  const address = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!isEmailAddress(address)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const result = await createFanLoginToken(address);
  if (result.ok) {
    const url = new URL("/signin/verify", APP_URL);
    url.searchParams.set("token", result.token);
    const to = safeNext(next);
    if (to !== "/") url.searchParams.set("next", to);
    // Sent even to someone who unsubscribed: they asked for this one.
    await sendEmail(result.email, fanLoginLinkEmail({ url: url.toString(), minutes: FAN_LINK_MINUTES }), {
      transactional: true,
    });
  }

  return NextResponse.json({ ok: true });
}
