import { NextRequest, NextResponse } from "next/server";
import { createArtistLoginToken } from "@/lib/artistLoginLink";
import { allowRequest } from "@/lib/rateLimit";
import { sendEmail, artistLoginLinkEmail } from "@/lib/email";

/**
 * Requests a sign-in link for an artist's own page.
 *
 * Always answers the same way. An unknown address, an artist with nothing in
 * the feed yet and a real one are indistinguishable from outside: anyone can
 * type anything into this box, and a form that says "no artist with that
 * address" is a way to find out who has submitted music, one guess at a time.
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
    return NextResponse.json(
      { error: "Enter the email address you submitted your music with." },
      { status: 400 }
    );
  }

  const result = await createArtistLoginToken(email);
  if (result.ok) {
    const appUrl = process.env.APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    await sendEmail(
      result.email,
      artistLoginLinkEmail({
        name: result.name,
        url: `${appUrl}/artist/verify?token=${encodeURIComponent(result.token)}`,
        minutes: 30,
      })
    );
  }

  return NextResponse.json({ ok: true });
}
