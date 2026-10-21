import { APP_URL } from "@/lib/appUrl";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Google sign-in for listeners. We only need identity —
 * Google confirms the person actually controls the email address, which is
 * the thing email-only sign-in couldn't prove.
 *
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL(`/?auth_error=not_configured`, APP_URL)
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "redirect_uri",
    process.env.GOOGLE_REDIRECT_URI ?? `${APP_URL}/api/auth/google/callback`
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
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
