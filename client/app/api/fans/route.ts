import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowRequest, tooManyRequests } from "@/lib/rateLimit";

// Lightweight fan identity — username only, no password. Fans need an
// account (not full anonymity) so saved tracks can later be pushed to their
// own Spotify/Apple Music playlist.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Anonymous listeners get a generated handle — no signup friction, and
  // nothing to remember. They just can't push saves to a playlist.
  if (body.anonymous) {
    // One vote per listener per track is enforced by a unique constraint, so
    // the way to manufacture votes is to manufacture listeners. This is the
    // gate on that. Set high enough that a shared office or mobile-carrier
    // address won't hit it, low enough that scripting it is pointless.
    const gate = await allowRequest("fanCreate", req);
    if (!gate.allowed) {
      return tooManyRequests(
        gate.retryAfterSeconds,
        "Too many new listeners from this connection. Try again shortly."
      );
    }

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

// There is deliberately no GET here.
//
// It used to list the fifty newest fans with no authentication and no select,
// which meant whole Fan rows: addresses, Google ids, and the Spotify access
// and refresh tokens. Nothing in the app ever called it; FanGate uses the POST
// above. A listing of everyone's accounts is not something this app needs to
// serve at all, so it is gone rather than guarded.
