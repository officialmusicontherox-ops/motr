import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canonicalOrigin, spotifyRedirectUri } from "@/lib/spotifyAuth";

/**
 * Spotify sends the listener back here. We trade the code for tokens, look
 * up who they are, and upsert a Fan keyed on their Spotify id so returning
 * on a different device lands on the same account.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const spotifyError = req.nextUrl.searchParams.get("error");
  const cookieState = req.cookies.get("spotify_oauth_state")?.value;

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(reason)}`, canonicalOrigin(req)));

  if (spotifyError) return fail(spotifyError);
  if (!code) return fail("missing_code");
  if (!state || !cookieState || state !== cookieState) return fail("bad_state");

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("server_not_configured");

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      // Must byte-match the value sent on the authorize step.
      redirect_uri: spotifyRedirectUri(req),
    }),
  });

  if (!tokenRes.ok) return fail("token_exchange_failed");
  const tokens = await tokenRes.json();

  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!meRes.ok) return fail("profile_fetch_failed");
  const me = await meRes.json();

  // Spotify display names aren't unique, so build a username that is.
  const base = (me.display_name || me.id || "listener")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20) || "listener";

  const expires = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  let fan = await prisma.fan.findUnique({ where: { spotifyId: me.id } });

  // Connecting Spotify to an account they already have. Without this the
  // callback would mint a second fan and strand every save on the first.
  const linkFanId = req.cookies.get("spotify_link_fan")?.value;
  if (!fan && linkFanId) {
    const target = await prisma.fan.findUnique({ where: { id: linkFanId } });
    if (target && !target.spotifyId) {
      fan = await prisma.fan.update({
        where: { id: target.id },
        data: {
          spotifyId: me.id,
          displayName: target.displayName ?? me.display_name ?? null,
          spotifyAccessToken: tokens.access_token,
          spotifyRefreshToken: tokens.refresh_token ?? null,
          spotifyTokenExpires: expires,
        },
      });
    }
  }

  if (fan) {
    fan = await prisma.fan.update({
      where: { id: fan.id },
      data: {
        displayName: me.display_name ?? fan.displayName,
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token ?? fan.spotifyRefreshToken,
        spotifyTokenExpires: expires,
      },
    });
  } else {
    let username = base;
    for (let i = 0; await prisma.fan.findUnique({ where: { username } }); i++) {
      username = `${base}${i + 1}`;
    }
    fan = await prisma.fan.create({
      data: {
        username,
        spotifyId: me.id,
        displayName: me.display_name ?? null,
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token ?? null,
        spotifyTokenExpires: expires,
      },
    });
  }

  // Hand the id to the client, which stores it the same way the anonymous
  // path does. (Real session cookies are the follow-up here.)
  const res = NextResponse.redirect(new URL(`/?fan=${fan.id}`, canonicalOrigin(req)));
  res.cookies.delete("spotify_oauth_state");
  return res;
}
