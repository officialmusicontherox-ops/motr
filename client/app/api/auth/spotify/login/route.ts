import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  canonicalOrigin,
  isLocalhostHost,
  requestHost,
  spotifyRedirectUri,
} from "@/lib/spotifyAuth";

// Scopes: identify the listener, and (later) push their saved tracks into a
// playlist they own. Nothing here needs Premium.
const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-library-modify",
  "playlist-modify-public",
  "playlist-modify-private",
].join(" ");

export async function GET(req: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "SPOTIFY_CLIENT_ID is not set" }, { status: 500 });
  }

  // If the browser came in on localhost, move it to the loopback IP *before*
  // starting the flow: Spotify won't accept a localhost redirect, and the
  // state cookie must be set on the same host we return to.
  if (isLocalhostHost(requestHost(req))) {
    return NextResponse.redirect(`${canonicalOrigin(req)}/api/auth/spotify/login`);
  }

  // CSRF guard: round-trip a random value and check it on the way back.
  const state = crypto.randomBytes(16).toString("hex");

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", spotifyRedirectUri(req));
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
