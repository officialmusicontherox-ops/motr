import { NextRequest, NextResponse } from "next/server";
import { SpotifyUserError, saveTrackToSpotify } from "@/lib/spotifyUser";

export async function POST(req: NextRequest) {
  const { fanId, trackId } = await req.json().catch(() => ({}));
  if (!fanId || !trackId) {
    return NextResponse.json({ error: "fanId and trackId are required" }, { status: 400 });
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
