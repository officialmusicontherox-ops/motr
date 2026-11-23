import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

/**
 * Artists' requests to change a song's genre or AI-vocals label, and the
 * approve or decline that applies them. Approving is the only thing that
 * changes the song.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pending = await prisma.trackChangeRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  const tracks = await prisma.track.findMany({
    where: { id: { in: pending.map((p) => p.trackId) } },
    select: { id: true, title: true, artistName: true, genre: true, aiGenerated: true, previewUrl: true, artworkUrl: true },
  });
  const byId = new Map(tracks.map((t) => [t.id, t]));
  return NextResponse.json({
    requests: pending
      .filter((p) => byId.has(p.trackId))
      .map((p) => {
        const t = byId.get(p.trackId)!;
        return {
          id: p.id,
          at: p.createdAt.toISOString(),
          title: t.title,
          artistName: t.artistName,
          artworkUrl: t.artworkUrl,
          previewUrl: t.previewUrl,
          genre: p.genre ? { from: t.genre, to: p.genre } : null,
          ai: p.aiGenerated === null ? null : { from: t.aiGenerated, to: p.aiGenerated },
        };
      }),
  });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, action } = await req.json().catch(() => ({}));
  if (action !== "APPROVE" && action !== "DECLINE") {
    return NextResponse.json({ error: "action must be APPROVE or DECLINE" }, { status: 400 });
  }
  const r = await prisma.trackChangeRequest.findFirst({ where: { id: String(id ?? ""), status: "PENDING" } });
  if (!r) return NextResponse.json({ error: "That request has already been dealt with." }, { status: 404 });

  if (action === "APPROVE") {
    await prisma.track.update({
      where: { id: r.trackId },
      data: {
        ...(r.genre ? { genre: r.genre } : {}),
        ...(r.aiGenerated !== null ? { aiGenerated: r.aiGenerated } : {}),
      },
    });
  }
  await prisma.trackChangeRequest.update({
    where: { id: r.id },
    data: { status: action === "APPROVE" ? "APPROVED" : "DECLINED", decidedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
