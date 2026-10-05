import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

/**
 * Everything about one artist, in one place.
 *
 * The same facts were reachable before, spread across the tracks list, the
 * failed-submissions queue and the email panels, which meant answering a
 * single artist's email took four sections and a good memory.
 *
 * Refusals are matched on the artist's address rather than through a
 * relation: a refusal exists precisely because no track was ever created, so
 * there is nothing for it to point at.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const artistId = req.nextUrl.searchParams.get("artistId");
  if (!artistId) {
    return NextResponse.json({ error: "artistId is required" }, { status: 400 });
  }

  const artist = await prisma.artist.findUnique({
    where: { id: artistId },
    select: {
      id: true,
      name: true,
      email: true,
      emailOptOut: true,
      lastNudgeAt: true,
      nudgeCount: true,
      sharePageEmailAt: true,
      createdAt: true,
      tracks: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          genre: true,
          aiGenerated: true,
          shareOpens: true,
          fanRightSwipes: true,
          fanLeftSwipes: true,
          audioVerdict: true,
          createdAt: true,
        },
      },
    },
  });
  if (!artist) return NextResponse.json({ error: "No such artist" }, { status: 404 });

  const [refusals, notifications] = await Promise.all([
    prisma.refusedSubmission.findMany({
      where: { artistEmail: { equals: artist.email, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, spotifyUrl: true, reason: true, status: true, attempts: true, createdAt: true },
    }),
    prisma.artistNotification.findMany({
      where: { artistId },
      orderBy: { sentAt: "desc" },
      take: 20,
      select: { id: true, type: true, sentAt: true, track: { select: { title: true } } },
    }),
  ]);

  return NextResponse.json({
    artist: {
      id: artist.id,
      name: artist.name,
      email: artist.email,
      optedOut: artist.emailOptOut,
      nudgeCount: artist.nudgeCount,
      lastNudgeAt: artist.lastNudgeAt?.toISOString() ?? null,
      toldAboutPage: artist.sharePageEmailAt?.toISOString() ?? null,
      since: artist.createdAt.toISOString(),
    },
    tracks: artist.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      genre: t.genre,
      ai: t.aiGenerated,
      opens: t.shareOpens,
      saves: t.fanRightSwipes,
      passes: t.fanLeftSwipes,
      verdict: t.audioVerdict,
      addedAt: t.createdAt.toISOString(),
    })),
    refusals: refusals.map((r) => ({
      id: r.id,
      url: r.spotifyUrl,
      reason: r.reason,
      status: r.status,
      attempts: r.attempts,
      at: r.createdAt.toISOString(),
    })),
    emails: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      track: n.track?.title ?? null,
      at: n.sentAt.toISOString(),
    })),
  });
}
