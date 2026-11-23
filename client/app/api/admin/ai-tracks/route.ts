import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

/**
 * For the admin AI Vocals tab: every submitted song marked as AI vocals,
 * or with ?show=unasked every one never labelled either way. All of them,
 * sorted by artist so one artist's songs sit together.
 *
 * The unasked list matters because the AI question was added to the
 * submit form partway through, and a listener who switches AI off still
 * hears unlabelled songs. Working through it is how that gap closes.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unasked = req.nextUrl.searchParams.get("show") === "unasked";
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tracks = await prisma.track.findMany({
    where: {
      aiGenerated: unasked ? null : true,
      status: { not: "REJECTED" },
      // Submitted songs only. The seeded catalogue is established releases
      // nobody is asking about.
      artistId: { not: null },
    },
    orderBy: [{ artistName: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      artistName: true,
      artworkUrl: true,
      previewUrl: true,
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
      previewUrl: t.previewUrl,
      genre: t.genre,
      addedAt: t.createdAt.toISOString(),
      account: t.artist ? t.artist.email : null,
    })),
  });
}
