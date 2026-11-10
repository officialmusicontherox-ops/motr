import { NextResponse } from "next/server";
import { spotlightTiles } from "@/lib/spotlight";

/**
 * The Spotlight tab's tiles.
 *
 * Public, and deliberately carries nothing identifying: artist name, photo,
 * genre and outbound links. No listener data, no fan ids, nothing that is
 * not already public on Spotify.
 */
export async function GET() {
  return NextResponse.json({ tiles: await spotlightTiles() });
}
