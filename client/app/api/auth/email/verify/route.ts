import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeLoginToken } from "@/lib/curatorLoginLink";
import { createCuratorSession } from "@/lib/curatorAuth";

/**
 * Spends a sign-in link and starts the session.
 *
 * POST rather than GET on purpose: mail scanners follow links before the
 * recipient sees them, and a one-time token spent by a scanner leaves the
 * curator with "expired" on their first real click.
 */
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));

  const email = await consumeLoginToken(typeof token === "string" ? token : "");
  if (!email) {
    return NextResponse.json(
      { error: "That link has expired or was already used. Ask for a new one." },
      { status: 400 }
    );
  }

  const curator = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, status: true },
  });

  if (!curator || curator.status === "SUSPENDED" || curator.status === "REMOVED") {
    return NextResponse.json({ error: "That account isn't active." }, { status: 403 });
  }

  await createCuratorSession(curator.id);
  return NextResponse.json({ ok: true, curatorId: curator.id });
}
