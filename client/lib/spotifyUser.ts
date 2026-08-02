import { prisma } from "./prisma";

/**
 * Acting on Spotify *as the fan*, using the token from their sign-in.
 *
 * This deliberately avoids our own app credentials: catalog calls with client
 * credentials 403 on this account, and preview URLs are gone for new apps. A
 * user token has none of those limits — search and library writes both work.
 */

export class SpotifyUserError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_connected"
      | "needs_reconnect"
      | "not_found"
      | "spotify_error" = "spotify_error"
  ) {
    super(message);
  }
}

/**
 * Returns a usable access token, refreshing it first if it's expired or about
 * to be. Access tokens last an hour, so any fan returning the next day needs
 * this.
 */
async function accessTokenFor(fanId: string): Promise<string> {
  const fan = await prisma.fan.findUnique({ where: { id: fanId } });
  if (!fan?.spotifyAccessToken) {
    throw new SpotifyUserError("Connect Spotify to save tracks.", "not_connected");
  }

  const expiresSoon =
    !fan.spotifyTokenExpires || fan.spotifyTokenExpires.getTime() - Date.now() < 60_000;

  if (!expiresSoon) return fan.spotifyAccessToken;

  if (!fan.spotifyRefreshToken) {
    throw new SpotifyUserError("Reconnect Spotify to keep saving.", "needs_reconnect");
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: fan.spotifyRefreshToken,
    }),
  });

  if (!res.ok) {
    throw new SpotifyUserError("Reconnect Spotify to keep saving.", "needs_reconnect");
  }

  const tokens = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  await prisma.fan.update({
    where: { id: fanId },
    data: {
      spotifyAccessToken: tokens.access_token,
      spotifyTokenExpires: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      // Spotify sometimes issues a new refresh token; keep the old one if not.
      ...(tokens.refresh_token ? { spotifyRefreshToken: tokens.refresh_token } : {}),
    },
  });

  return tokens.access_token;
}

/**
 * Finds the track on Spotify. Most of our catalog is sourced from iTunes and
 * carries no Spotify id, so we look it up by title and artist using the fan's
 * own token.
 */
async function findSpotifyTrackId(
  token: string,
  title: string,
  artistName: string
): Promise<string> {
  // Strip the featured-artist tail — it hurts match rates on Spotify search.
  const cleanTitle = title.replace(/\s*[([]\s*(feat|ft|with)\.?[^)\]]*[)\]]/gi, "").trim();
  const primaryArtist = artistName.split(/[,&]|\bfeat\.?\b/i)[0].trim();

  const q = `track:${cleanTitle} artist:${primaryArtist}`;
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`,
    { headers: { authorization: `Bearer ${token}` } }
  );

  if (res.status === 401) {
    throw new SpotifyUserError("Reconnect Spotify to keep saving.", "needs_reconnect");
  }
  if (!res.ok) throw new SpotifyUserError("Spotify search failed.");

  const data = (await res.json()) as { tracks?: { items?: { id: string }[] } };
  const id = data.tracks?.items?.[0]?.id;
  if (!id) {
    throw new SpotifyUserError("Couldn't find this track on Spotify.", "not_found");
  }
  return id;
}

/** Adds a track to the fan's Spotify library ("Liked Songs"). Idempotent. */
export async function saveTrackToSpotify(fanId: string, trackId: string) {
  const token = await accessTokenFor(fanId);

  const swipe = await prisma.fanSwipe.findUnique({
    where: { fanId_trackId: { fanId, trackId } },
    include: { track: true },
  });
  if (!swipe) throw new SpotifyUserError("You haven't saved that track.", "not_found");

  // Prefer an id we already resolved, then the track's own Spotify id if it
  // was submitted as a Spotify link, then fall back to searching.
  const spotifyId =
    swipe.spotifyTrackId ??
    (swipe.track.source === "SPOTIFY" && /^[A-Za-z0-9]{22}$/.test(swipe.track.externalId)
      ? swipe.track.externalId
      : await findSpotifyTrackId(token, swipe.track.title, swipe.track.artistName));

  const res = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${spotifyId}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });

  if (res.status === 401) {
    throw new SpotifyUserError("Reconnect Spotify to keep saving.", "needs_reconnect");
  }
  if (res.status === 403) {
    // Fans who signed in before we asked for library access need to re-consent.
    throw new SpotifyUserError(
      "Reconnect Spotify to grant library access.",
      "needs_reconnect"
    );
  }
  if (!res.ok) throw new SpotifyUserError("Spotify wouldn't save that track.");

  await prisma.fanSwipe.update({
    where: { fanId_trackId: { fanId, trackId } },
    data: { savedToSpotifyAt: new Date(), spotifyTrackId: spotifyId },
  });

  return { spotifyId };
}
