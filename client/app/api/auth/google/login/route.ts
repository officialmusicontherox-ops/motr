import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Google sign-in, shared by curators and fans. We only need identity —
 * Google confirms the person actually controls the email address, which is
 * the thing email-only sign-in couldn't prove.
 *
 * `?as=fan` distinguishes the two: a curator must already have an approved
 * account, whereas a fan account is created on the spot. The choice rides
 * along in the state cookie rather than the URL, so it can't be swapped
 * between the redirect and the callback.
 *
 * `?merge=<fanId>` carries an anonymous fan's existing swipes so they aren't
 * lost when that person finally makes an account.
 *
 * Unlike Spotify, Google accepts http://localhost redirect URIs, so there's
 * no loopback-IP dance for local development.
 */
export async function GET(req: NextRequest) {
  const asFan = req.nextUrl.searchParams.get("as") === "fan";
  const mergeFanId = req.nextUrl.searchParams.get("merge") ?? "";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL(`${asFan ? "/" : "/curate"}?auth_error=not_configured`, req.nextUrl.origin)
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "redirect_uri",
    process.env.GOOGLE_REDIRECT_URI ?? `${req.nextUrl.origin}/api/auth/google/callback`
  );
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  // Keeps the account chooser from silently reusing a stale session.
  url.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(url.toString());
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
  res.cookies.set("google_oauth_as", asFan ? "fan" : "curator", cookieOpts);
  if (mergeFanId) res.cookies.set("google_oauth_merge", mergeFanId, cookieOpts);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
