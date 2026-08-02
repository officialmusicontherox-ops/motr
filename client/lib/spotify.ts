// Client-credentials lookup against Spotify's public catalog. Only reads
// public track metadata (title/artist/artwork/preview_url) — no user auth.
// Requires SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in the environment.

type SpotifyToken = { accessToken: string; expiresAt: number };

let cachedToken: SpotifyToken | null = null;

async function getAppToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not configured"
    );
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    // refresh a little early
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.accessToken;
}

export type NormalizedTrack = {
  source: "SPOTIFY";
  externalId: string;
  isrc: string | null;
  title: string;
  artistName: string;
  albumName: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
};

type SpotifyTrackResponse = {
  id: string;
  name: string;
  duration_ms: number;
  preview_url: string | null;
  external_ids?: { isrc?: string };
  album: { name: string; images: { url: string }[] };
  artists: { name: string }[];
};

function normalize(track: SpotifyTrackResponse): NormalizedTrack {
  return {
    source: "SPOTIFY",
    externalId: track.id,
    isrc: track.external_ids?.isrc ?? null,
    title: track.name,
    artistName: track.artists.map((a) => a.name).join(", "),
    albumName: track.album?.name ?? null,
    artworkUrl: track.album?.images?.[0]?.url ?? null,
    previewUrl: track.preview_url,
    durationMs: track.duration_ms ?? null,
  };
}

export async function getSpotifyTrack(trackId: string): Promise<NormalizedTrack> {
  const token = await getAppToken();
  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify track lookup failed: ${res.status}`);
  }
  const data = (await res.json()) as SpotifyTrackResponse;
  return normalize(data);
}

export async function searchSpotifyTrack(query: string): Promise<NormalizedTrack[]> {
  const token = await getAppToken();
  const res = await fetch(
    `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`Spotify search failed: ${res.status}`);
  }
  const data = (await res.json()) as { tracks: { items: SpotifyTrackResponse[] } };
  return data.tracks.items.map(normalize);
}
