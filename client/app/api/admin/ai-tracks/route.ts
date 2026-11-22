import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

/**
 * Every song in rotation marked as having AI vocals, for the admin AI
 * Vocals tab. All of them, not the Tracks list's first 200, sorted by
 * artist so one artist's songs sit together.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tracks = await prisma.track.findMany({
    where: { aiGenerated: true, status: { not: "REJECTED" } },
    orderBy: [{ artistName: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      artistName: true,
      artworkUrl: true,
      genre: true,
      createdAt: true,
      artist: { select: { name: true, email: true } },
    },
  });
  return NextResponse.json({
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName: t.artistName,
      artworkUrl: t.artworkUrl,
      genre: t.genre,
      addedAt: t.createdAt.toISOString(),
      account: t.artist ? t.artist.email : null,
    })),
  });
}
