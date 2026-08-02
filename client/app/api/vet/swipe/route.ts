import { NextRequest, NextResponse } from "next/server";
import { AlreadySwipedError, recordSwipe } from "@/lib/vetting";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, trackId, direction, listenDurationMs } = body;

  if (!userId || !trackId || (direction !== "LEFT" && direction !== "RIGHT")) {
    return NextResponse.json(
      { error: "userId, trackId, and direction ('LEFT' | 'RIGHT') are required" },
      { status: 400 }
    );
  }

  try {
    const { track, justGraduated } = await recordSwipe({
      userId,
      trackId,
      direction,
      listenDurationMs,
    });
    return NextResponse.json({ track, justGraduated });
  } catch (e) {
    if (e instanceof AlreadySwipedError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}
