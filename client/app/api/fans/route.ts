import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lightweight fan identity — username only, no password. Fans need an
// account (not full anonymity) so saved tracks can later be pushed to their
// own Spotify/Apple Music playlist.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Anonymous listeners get a generated handle — no signup friction, and
  // nothing to remember. They just can't push saves to a playlist.
  if (body.anonymous) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const username = `listener${Math.random().toString(36).slice(2, 8)}`;
      const taken = await prisma.fan.findUnique({ where: { username } });
      if (taken) continue;
      const fan = await prisma.fan.create({ data: { username } });
      return NextResponse.json({ fan, alreadyExisted: false }, { status: 201 });
    }
    return NextResponse.json({ error: "Could not start a session" }, { status: 500 });
  }

  const { username } = body;
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const existing = await prisma.fan.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ fan: existing, alreadyExisted: true });
  }

  const fan = await prisma.fan.create({ data: { username } });
  return NextResponse.json({ fan, alreadyExisted: false }, { status: 201 });
}

export async function GET() {
  const fans = await prisma.fan.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ fans });
}
