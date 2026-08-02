import { NextRequest, NextResponse } from "next/server";
import { AlreadySwipedError, recordFanSwipe } from "@/lib/discovery";

export async function POST(req: NextRequest) {
  const { fanId, trackId, direction } = await req.json();

  if (!fanId || !trackId || (direction !== "LEFT" && direction !== "RIGHT")) {
    return NextResponse.json(
      { error: "fanId, trackId, and direction ('LEFT' | 'RIGHT') are required" },
      { status: 400 }
    );
  }

  try {
    const { track, feeNowRequested } = await recordFanSwipe({ fanId, trackId, direction });
    return NextResponse.json({ track, feeNowRequested });
  } catch (e) {
    if (e instanceof AlreadySwipedError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}
