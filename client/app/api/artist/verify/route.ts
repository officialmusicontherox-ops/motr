import { NextRequest, NextResponse } from "next/server";
import { consumeArtistToken } from "@/lib/artistLoginLink";
import { createArtistSession } from "@/lib/artistAuth";

/** Spends a sign-in link and starts the session. POST, so mail scanners can't burn it. */
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));

  const artistId = await consumeArtistToken(typeof token === "string" ? token : "");
  if (!artistId) {
    return NextResponse.json(
      { error: "That link has expired or was already used. Ask for a new one." },
      { status: 400 }
    );
  }

  await createArtistSession(artistId);
  return NextResponse.json({ ok: true });
}
