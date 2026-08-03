import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Google returns the curator here. We trade the code for an ID token, read
 * the *verified* email out of it, and match it to a curator account.
 *
 * Accounts are only ever created by an admin approving an application — so
 * signing in with a Google account we don't recognise tells you to apply
 * rather than quietly creating a curator.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const googleError = req.nextUrl.searchParams.get("error");
  const cookieState = req.cookies.get("google_oauth_state")?.value;

  const back = (params: string) =>
    NextResponse.redirect(new URL(`/curate?${params}`, req.nextUrl.origin));

  if (googleError) return back(`auth_error=${encodeURIComponent(googleError)}`);
  if (!code) return back("auth_error=missing_code");
  if (!state || !cookieState || state !== cookieState) return back("auth_error=bad_state");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return back("auth_error=not_configured");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri:
        process.env.GOOGLE_REDIRECT_URI ?? `${req.nextUrl.origin}/api/auth/google/callback`,
    }),
  });
  if (!tokenRes.ok) return back("auth_error=token_exchange_failed");

  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) return back("auth_error=no_id_token");

  // The ID token is signed by Google; we read the claims from the payload.
  const payload = JSON.parse(
    Buffer.from(tokens.id_token.split(".")[1], "base64").toString("utf8")
  ) as { email?: string; email_verified?: boolean | string };

  const email = payload.email?.trim().toLowerCase();
  const verified = payload.email_verified === true || payload.email_verified === "true";
  if (!email) return back("auth_error=no_email");
  if (!verified) return back("auth_error=email_unverified");

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, status: true },
  });

  if (user) {
    // Google proving who they are isn't the same as the account being
    // allowed in — a suspended curator must not reach their queue or their
    // payout details.
    if (user.status === "SUSPENDED" || user.status === "REMOVED") {
      return back("auth_error=account_inactive");
    }
    return back(`curator=${user.id}`);
  }

  // No account: say which situation they're in rather than a dead end.
  const application = await prisma.curatorApplication.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { status: true },
  });

  if (application?.status === "PENDING") return back("auth_error=pending");
  if (application?.status === "DECLINED") return back("auth_error=declined");
  return back(`auth_error=no_account&email=${encodeURIComponent(email)}`);
}
