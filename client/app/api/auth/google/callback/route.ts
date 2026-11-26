import { APP_URL } from "@/lib/appUrl";
import { NextRequest, NextResponse } from "next/server";
import { signInFan } from "@/lib/fanSignIn";
import { safeNext } from "@/lib/safeNext";
import { fanSessionCookie, getFanSession } from "@/lib/fanAuth";

/**
 * Google returns here after a listener signs in. We trade the code for an ID
 * token and read the *verified* email out of it.
 *
 * The account is created on the spot, because there is nothing to vet. An
 * anonymous session swiped on the same browser is absorbed into it, so
 * signing in keeps the history rather than starting again.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const googleError = req.nextUrl.searchParams.get("error");
  const cookieState = req.cookies.get("google_oauth_state")?.value;

  /**
   * Whose anonymous history to absorb: the session this browser already
   * holds, never a value handed in.
   *
   * It used to come from ?merge= on the sign-in link, round-tripped through
   * a cookie. Anyone who knew an anonymous listener's id could name it,
   * sign in as themselves, and walk off with that listener's entire swipe
   * history. The account was then deleted, so there was nothing to go back
   * to, and the listeners it applied to are exactly the ones with no email
   * and no way to recover.
   */
  const mergeFanId = (await getFanSession()) ?? undefined;

  // Where they were headed when the sign-in wall stopped them: a shared song,
  // a battle, Charts. Checked again here, since a cookie can be edited.
  const next = safeNext(req.cookies.get("motr_next")?.value);

  const back = (params: string) => {
    const res = NextResponse.redirect(
      new URL(`${next}${next.includes("?") ? "&" : "?"}${params}`, APP_URL)
    );
    for (const c of ["google_oauth_state", "google_oauth_as", "motr_next"]) {
      res.cookies.set(c, "", { path: "/", maxAge: 0 });
    }
    return res;
  };

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
        process.env.GOOGLE_REDIRECT_URI ?? `${APP_URL}/api/auth/google/callback`,
    }),
  });
  if (!tokenRes.ok) return back("auth_error=token_exchange_failed");

  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) return back("auth_error=no_id_token");

  // The ID token is signed by Google; we read the claims from the payload.
  const payload = JSON.parse(
    Buffer.from(tokens.id_token.split(".")[1], "base64").toString("utf8")
  ) as { email?: string; email_verified?: boolean | string; name?: string; sub?: string };

  const email = payload.email?.trim().toLowerCase();
  const verified = payload.email_verified === true || payload.email_verified === "true";
  if (!email) return back("auth_error=no_email");
  if (!verified) return back("auth_error=email_unverified");

  // Fan sign-in is the only kind. The curator half of this route issued a
  // signed curator_session to anyone in the User table, of which seven rows
  // are still ACTIVE, and it stayed reachable months after the programme
  // ended. Nothing linked to it and nothing could have used it for anything,
  // which is exactly why it was worth removing rather than leaving.
  const fan = await signInFan(email, payload.name, mergeFanId);
  // Deliberately not `fan=<id>`. That put the id in browser history and in
  // the referrer of everything the page went on to load. The session is in
  // the cookie; the page asks /api/fans/me who it is.
  // Set on the response itself, like the state cookies above it. A redirect
  // builds its own response, and that is the pattern these routes already
  // rely on.
  const res = back("signedin=1");
  const session = fanSessionCookie(fan.id);
  res.cookies.set(session.name, session.value, session.options);
  return res;
}
