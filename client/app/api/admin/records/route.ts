import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

// Browsable operational records for the dashboard: tracks, payments,
// artists, and curators.
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kind = req.nextUrl.searchParams.get("kind") ?? "tracks";

  switch (kind) {
    case "tracks": {
      const tracks = await prisma.track.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          artist: { select: { name: true, email: true } },
          payment: { select: { status: true, amountCents: true, currency: true } },
        },
      });
      return NextResponse.json({ tracks });
    }
    case "payments": {
      const payments = await prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          track: { select: { title: true, artistName: true } },
          artist: { select: { name: true, email: true } },
        },
      });
      return NextResponse.json({ payments });
    }
    case "artists": {
      const artists = await prisma.artist.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { _count: { select: { tracks: true, payments: true } } },
      });
      return NextResponse.json({ artists });
    }
    case "curators": {
      const curators = await prisma.user.findMany({
        orderBy: { curationWeight: "desc" },
        take: 100,
        include: { _count: { select: { swipes: true, payouts: true } } },
      });
      return NextResponse.json({ curators });
    }
    default:
      return NextResponse.json(
        { error: "kind must be one of: tracks, payments, artists, curators" },
        { status: 400 }
      );
  }
}
