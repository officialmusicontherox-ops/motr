import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/artistAuth";

/**
 * Everything an artist's own page shows.
 *
 * The artist id comes from the signed cookie, never from the request, so
 * there is no parameter anyone could change to read somebody else's numbers.
 */
export async function GET() {
  const session = await requireArtist();
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const tracks = await prisma.track.findMany({
    where: { artistId: session.artistId, status: { not: "REJECTED" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      shareOpens: true,
      fanRightSwipes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    name: session.name,
    email: session.email,
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      opens: t.shareOpens,
      saves: t.fanRightSwipes,
      addedAt: t.createdAt.toISOString(),
    })),
  });
}
