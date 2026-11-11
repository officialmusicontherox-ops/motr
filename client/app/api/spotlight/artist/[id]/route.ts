import { NextRequest, NextResponse } from "next/server";
import { artistCard } from "@/lib/spotlight";

/**
 * One artist's public card, for the sheet that opens from a saved track.
 *
 * Same shape and the same rules as a Spotlight tile: name, photo, genre and
 * outbound links, nothing else. A listener tapping an artist's name in their
 * saved list has already seen that name, so this reveals nothing the screen
 * behind it did not.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const card = await artistCard(id);
  if (!card) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ artist: card });
}
