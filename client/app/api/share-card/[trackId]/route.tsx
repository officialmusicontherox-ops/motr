import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderShareCard } from "@/lib/shareCard";

/**
 * The image an artist posts.
 *
 * Deliberately public and keyed on the track id. Everything on the card --
 * title, artist, the share link -- is already public: the link is in every
 * post an artist makes. Keeping it open is what lets an email embed the card
 * as a plain <img>, which is the whole point of sending one.
 *
 * The drawing itself lives in lib/shareCard so it can be rendered and looked
 * at without a running server.
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  const square = req.nextUrl.searchParams.get("shape") === "post";

  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: { id: true, title: true, artistName: true, status: true },
  });
  if (!track || track.status === "REJECTED") {
    return new Response("Not found", { status: 404 });
  }

  return renderShareCard({
    trackId: track.id,
    title: track.title,
    artistName: track.artistName,
    square,
  });
}
