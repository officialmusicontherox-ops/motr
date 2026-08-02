import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Google sign-in for curators. We only need identity — Google confirms the
 * person actually controls the email address, which is the thing email-only
 * sign-in couldn't prove.
 *
 * Unlike Spotify, Google accepts http://localhost redirect URIs, so there's
 * no loopback-IP dance for local development.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/curate?auth_error=not_configured", req.nextUrl.origin)
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
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
