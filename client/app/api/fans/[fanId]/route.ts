import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Look up a single fan by id. The list endpoint only returns recent fans, so
// a returning listener wouldn't be found there once the app has any volume.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fanId: string }> }
) {
  const { fanId } = await params;

  const fan = await prisma.fan.findUnique({
    where: { id: fanId },
    select: { id: true, username: true, displayName: true, spotifyId: true },
  });

  if (!fan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Don't leak tokens to the client — only whether they're connected.
  return NextResponse.json({
    fan: {
      id: fan.id,
      username: fan.username,
      displayName: fan.displayName,
      hasSpotify: Boolean(fan.spotifyId),
    },
  });
}
