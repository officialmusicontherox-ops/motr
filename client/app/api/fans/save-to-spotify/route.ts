import { NextRequest, NextResponse } from "next/server";
import { SpotifyUserError, saveTrackToSpotify } from "@/lib/spotifyUser";
import { getFanSession } from "@/lib/fanAuth";

export async function POST(req: NextRequest) {
  // From the cookie. This writes into the listener's own Spotify library
  // using their stored tokens, so being told whose library to write to was
  // the wrong shape entirely.
  const fanId = await getFanSession();
  if (!fanId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { trackId } = await req.json().catch(() => ({}));
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  try {
    const { spotifyId } = await saveTrackToSpotify(fanId, trackId);
    return NextResponse.json({ ok: true, spotifyId });
  } catch (e) {
    if (e instanceof SpotifyUserError) {
      // 409 for states the fan can fix (connect / reconnect / no match) so the
      // UI can prompt rather than showing a generic failure.
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    throw e;
  }
}
