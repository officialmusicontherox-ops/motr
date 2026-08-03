import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

/**
 * Every track on the platform, so a bad one can be pulled quickly — wrong
 * audio, a mis-tagged genre, something a rights holder objects to, or a
 * submission that shouldn't have gone live.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const view = req.nextUrl.searchParams.get("view") ?? "live";
  const q = req.nextUrl.searchParams.get("q")?.trim();

  // Sorting matters for answering "is this artist's track on there?" and for
  // spotting what arrived since you last looked.
  const SORTS = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    title: { title: "asc" },
    artist: { artistName: "asc" },
    popular: { fanRightSwipes: "desc" },
  } as const;
  const sortKey = (req.nextUrl.searchParams.get("sort") ?? "newest") as keyof typeof SORTS;
  const orderBy = SORTS[sortKey] ?? SORTS.newest;

  const where: Record<string, unknown> = {};
  if (view === "live") where.status = "DISCOVERY";
  else if (view === "pulled") where.status = "REJECTED";
  else if (view === "submitted") where.NOT = { artistId: null };
  else if (view === "curators") where.status = { in: ["VETTING", "GRADUATED"] };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { artistName: { contains: q, mode: "insensitive" } },
    ];
  }

  const tracks = await prisma.track.findMany({
    where,
    orderBy,
    take: 200,
    include: {
      artist: { select: { name: true, email: true } },
      _count: { select: { fanSwipes: true, assignments: true } },
    },
  });

  const [live, pulled, submitted, withCurators] = await Promise.all([
    prisma.track.count({ where: { status: "DISCOVERY" } }),
    prisma.track.count({ where: { status: "REJECTED" } }),
    prisma.track.count({ where: { NOT: { artistId: null } } }),
    prisma.track.count({ where: { status: { in: ["VETTING", "GRADUATED"] } } }),
  ]);

  return NextResponse.json({
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName: t.artistName,
      albumName: t.albumName,
      artworkUrl: t.artworkUrl,
      previewUrl: t.previewUrl,
      genre: t.genre,
      status: t.status,
      feeStatus: t.feeStatus,
      reviewStatus: t.reviewStatus,
      fanRightSwipes: t.fanRightSwipes,
      fanLeftSwipes: t.fanLeftSwipes,
      requiredFanVotes: t.requiredFanVotes,
      requiredApprovalRate: t.requiredApprovalRate,
      addedAt: t.createdAt,
      // No artist means it's catalogue we seeded, not a paid submission.
      submittedBy: t.artist ? { name: t.artist.name, email: t.artist.email } : null,
      swipes: t._count.fanSwipes,
      curatorsAssigned: t._count.assignments,
    })),
    counts: { live, pulled, submitted, withCurators },
  });
}

/**
 * Pulls a track out of rotation, or puts it back.
 *
 * Uses the REJECTED status rather than deleting the row: swipes, assignments
 * and payments reference it, and a deleted track would take a fan's saved
 * list and an artist's payment record with it.
 */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { trackId, action, note } = await req.json().catch(() => ({}));
  if (!trackId || (action !== "PULL" && action !== "RESTORE")) {
    return NextResponse.json(
      { error: "trackId and action ('PULL' | 'RESTORE') are required" },
      { status: 400 }
    );
  }

  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  const updated = await prisma.track.update({
    where: { id: trackId },
    data: {
      status: action === "PULL" ? "REJECTED" : "DISCOVERY",
      reviewNote: typeof note === "string" && note.trim() ? note.trim() : track.reviewNote,
    },
  });

  return NextResponse.json({ track: { id: updated.id, status: updated.status } });
}
