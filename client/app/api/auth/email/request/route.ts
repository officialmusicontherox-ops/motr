import { NextRequest, NextResponse } from "next/server";
import { createLoginToken } from "@/lib/curatorLoginLink";
import { curatorLoginLinkEmail, sendEmail } from "@/lib/email";
import { allowRequest, tooManyRequests } from "@/lib/rateLimit";

/**
 * Asks for a sign-in link.
 *
 * Says plainly when an address has no curator account. That does reveal
 * whether an address curates here, which for a public signup would be worth
 * hiding — but there is no public signup: accounts exist only because an
 * admin approved one. The alternative, "if that address has an account we've
 * sent a link", leaves a genuinely confused person with nothing to act on,
 * which is the failure this whole feature exists to fix.
 */
export async function POST(req: NextRequest) {
  const gate = await allowRequest("signInLink", req);
  if (!gate.allowed) {
    return tooManyRequests(gate.retryAfterSeconds, "Too many sign-in emails. Try again shortly.");
  }

  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Enter your email address." }, { status: 400 });
  }

  const result = await createLoginToken(email);

  if (!result.ok) {
    if (result.reason === "unknown") {
      return NextResponse.json(
        {
          error:
            "No curator account for that address. If you applied with a different one, try that — or apply below.",
        },
        { status: 404 }
      );
    }
    if (result.reason === "inactive") {
      return NextResponse.json(
        { error: "That account isn't active right now. Reply to any MOTR email and we'll look." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "We've sent a few already — check your inbox, or try again in a little while." },
      { status: 429 }
    );
  }

  const appUrl =
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://app.musicontherox.com");

  const mail = await sendEmail(
    result.email,
    curatorLoginLinkEmail({
      url: `${appUrl}/curator/signin?token=${encodeURIComponent(result.token)}`,
      minutes: 15,
    })
  );

  if (!mail.ok) {
    return NextResponse.json(
      { error: "We couldn't send the email just now. Try again in a moment." },
      { status: 502 }
    );
  }

  return NextResponse.json({ sent: true, to: result.email });
}
