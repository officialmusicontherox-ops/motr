import { APP_URL } from "@/lib/appUrl";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createFanSession } from "@/lib/fanAuth";

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

  const mergeFanId = req.cookies.get("google_oauth_merge")?.value;

  const back = (params: string) => {
    const res = NextResponse.redirect(
      new URL(`/?${params}`, APP_URL)
    );
    for (const c of ["google_oauth_state", "google_oauth_as", "google_oauth_merge"]) {
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
  await createFanSession(fan.id);
  return back(`fan=${fan.id}`);
}

async function signInFan(email: string, name: string | undefined, mergeFanId?: string) {
  const existing = await prisma.fan.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  const fan =
    existing ??
    (await prisma.fan.create({
      data: {
        email,
        displayName: name ?? null,
        username: `${(name ?? email.split("@")[0]).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "listener"}${Math.random().toString(36).slice(2, 6)}`,
      },
    }));

  if (mergeFanId && mergeFanId !== fan.id) {
    const anon = await prisma.fan.findUnique({ where: { id: mergeFanId } });
    // Only ever absorb a genuinely anonymous session, never another account.
    if (anon && !anon.email && !anon.spotifyId) {
      const swipes = await prisma.fanSwipe.findMany({ where: { fanId: mergeFanId } });
      for (const s of swipes) {
        await prisma.fanSwipe
          .update({ where: { id: s.id }, data: { fanId: fan.id } })
          .catch(async () => {
            // Already swiped that track on the signed-in account — the
            // anonymous copy is redundant.
            await prisma.fanSwipe.delete({ where: { id: s.id } }).catch(() => {});
          });
      }
      await prisma.fan.delete({ where: { id: mergeFanId } }).catch(() => {});
    }
  }

  return fan;
}
