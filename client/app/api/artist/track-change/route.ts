import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "@/lib/artistAuth";
import { GENRES } from "@/lib/genres";
import { sendEmail, trackChangeRequestEmail } from "@/lib/email";

/**
 * An artist asking to change one of their songs' genre or AI-vocals label.
 *
 * Only ever a request: the song is not touched until an admin approves it.
 * The artist comes from the signed cookie, and the song must be theirs.
 * A newer request for the same song replaces a pending one.
 */
export async function POST(req: NextRequest) {
  const session = await requireArtist();
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

  const { trackId, genre, aiGenerated } = await req.json().catch(() => ({}));
  const track = await prisma.track.findFirst({
    where: { id: String(trackId ?? ""), artistId: session.artistId, status: { not: "REJECTED" } },
    select: { id: true, title: true, genre: true, aiGenerated: true },
  });
  if (!track) return NextResponse.json({ error: "That song isn't on your account." }, { status: 404 });

  const newGenre =
    typeof genre === "string" && (GENRES as readonly string[]).includes(genre) && genre !== track.genre ? genre : null;
  const newAi = typeof aiGenerated === "boolean" && aiGenerated !== track.aiGenerated ? aiGenerated : null;
  if (newGenre === null && newAi === null) {
    return NextResponse.json({ error: "Nothing has changed." }, { status: 400 });
  }

  await prisma.trackChangeRequest.updateMany({
    where: { trackId: track.id, status: "PENDING" },
    data: { status: "REPLACED", decidedAt: new Date() },
  });
  const request = await prisma.trackChangeRequest.create({
    data: { trackId: track.id, artistId: session.artistId, genre: newGenre, aiGenerated: newAi },
  });

  if (process.env.EMAIL_REPLY_TO) {
    const changes = [
      ...(newGenre ? [`Genre: ${track.genre ?? "none"} to ${newGenre}`] : []),
      ...(newAi !== null ? [`AI vocals: ${track.aiGenerated === null ? "not asked" : track.aiGenerated ? "yes" : "no"} to ${newAi ? "yes" : "no"}`] : []),
    ];
    await sendEmail(
      process.env.EMAIL_REPLY_TO,
      trackChangeRequestEmail({ artistName: session.name, title: track.title, changes }),
      { transactional: true }
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, request: { genre: request.genre, aiGenerated: request.aiGenerated } });
}
