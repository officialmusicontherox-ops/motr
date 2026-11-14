import { NextRequest, NextResponse } from "next/server";
import { getFanSession } from "@/lib/fanAuth";
import { prisma } from "@/lib/prisma";
import { NoCreditsError, creditsFor, spendCredit } from "@/lib/spotlight";

/** How many Spotlights the listener is holding. */
export async function GET() {
  const fanId = await getFanSession();
  if (!fanId) return NextResponse.json({ credits: 0 });
  return NextResponse.json({ credits: await creditsFor(fanId) });
}

/**
 * Spend one Spotlight.
 *
 * Takes an artist, or a track and resolves the artist from it, because a
 * swipe up happens on a blind card where the listener does not know whose
 * song it is. That is the point: you are backing what you just heard, not a
 * name you recognised.
 */
export async function POST(req: NextRequest) {
  // Whoever holds the session, never whoever the body names: being told
  // would let one listener spend another's Spotlights.
  const fanId = await getFanSession();
  if (!fanId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { artistId, trackId } = await req.json().catch(() => ({}));

  let target: string | null = artistId ?? null;
  if (!target && trackId) {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      select: { artistId: true },
    });
    target = track?.artistId ?? null;
  }

  // The seeded catalogue has no artist record, so there is nobody to give a
  // slot to. Saying so plainly beats taking a credit for nothing.
  if (!target) {
    return NextResponse.json({ error: "No artist behind that track" }, { status: 400 });
  }

  try {
    const { queued, left } = await spendCredit(fanId, target, trackId ?? null);
    return NextResponse.json({ ok: true, queued, credits: left });
  } catch (e) {
    if (e instanceof NoCreditsError) {
      return NextResponse.json({ error: "No Spotlights left", credits: 0 }, { status: 402 });
    }

    throw e;
  }
}
