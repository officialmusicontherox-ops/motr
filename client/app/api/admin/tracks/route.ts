import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { GENRES } from "@/lib/genres";

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

  const trackIds = tracks.map((t) => t.id);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // A&R signal. How long someone listened before deciding separates "looked
  // interesting" from "held me", and it's the thing streaming numbers can't
  // tell you because they only count plays that already happened.
  const [listenStats, heldStats, recentVotes] = await Promise.all([
    prisma.fanSwipe.groupBy({
      by: ["trackId"],
      where: { trackId: { in: trackIds }, NOT: { listenMs: null } },
      _avg: { listenMs: true },
      _count: { _all: true },
    }),
    // Right-swipes that came after most of the clip had played.
    prisma.fanSwipe.groupBy({
      by: ["trackId"],
      where: { trackId: { in: trackIds }, direction: "RIGHT", listenMs: { gte: 20_000 } },
      _count: { _all: true },
    }),
    prisma.fanSwipe.groupBy({
      by: ["trackId"],
      where: { trackId: { in: trackIds }, createdAt: { gte: weekAgo } },
      _count: { _all: true },
    }),
  ]);

  const avgListen = new Map(listenStats.map((r) => [r.trackId, r._avg.listenMs]));
  const measured = new Map(listenStats.map((r) => [r.trackId, r._count._all]));
  const heldToEnd = new Map(heldStats.map((r) => [r.trackId, r._count._all]));
  const thisWeek = new Map(recentVotes.map((r) => [r.trackId, r._count._all]));

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

      // Null until enough swipes carry a measured listen time.
      avgListenMs: Math.round(avgListen.get(t.id) ?? 0) || null,
      measuredSwipes: measured.get(t.id) ?? 0,
      // Of everyone who liked it, how many stayed for most of the clip.
      convictionRate:
        t.fanRightSwipes > 0 ? (heldToEnd.get(t.id) ?? 0) / t.fanRightSwipes : null,
      votesThisWeek: thisWeek.get(t.id) ?? 0,
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

  const { trackId, action, note, genre } = await req.json().catch(() => ({}));

  // Correcting a genre matters as much as removing a track: routing is by
  // genre, so a country song filed under R&B reaches five curators who
  // can't use it.
  if (action === "SET_GENRE") {
    if (!trackId || typeof genre !== "string" || !(GENRES as readonly string[]).includes(genre)) {
      return NextResponse.json({ error: "trackId and a valid genre are required" }, { status: 400 });
    }
    const updated = await prisma.track.update({ where: { id: trackId }, data: { genre } });
    return NextResponse.json({ track: { id: updated.id, genre: updated.genre } });
  }

  if (!trackId || (action !== "PULL" && action !== "RESTORE")) {
    return NextResponse.json(
      { error: "trackId and action ('PULL' | 'RESTORE' | 'SET_GENRE') are required" },
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
