import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createFanSession } from "@/lib/fanAuth";
import { allowRequest, tooManyRequests } from "@/lib/rateLimit";

/** je•••t@gmail.com — recognisable to its owner, useless to anyone else. */
function mask(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = local.slice(0, 2);
  const tail = local.length > 3 ? local.slice(-1) : "";
  return `${head}${"•".repeat(3)}${tail}@${domain}`;
}

// Look up a single fan by id. The list endpoint only returns recent fans, so
// a returning listener wouldn't be found there once the app has any volume.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fanId: string }> }
) {
  const { fanId } = await params;

  const fan = await prisma.fan.findUnique({
    where: { id: fanId },
    select: { id: true, username: true, displayName: true, spotifyId: true, email: true },
  });

  if (!fan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Issued here as well as on creation, so the listeners who already had an
  // id in localStorage before this existed keep their saves. It is the last
  // place an id is accepted from the client; everything else reads the cookie.
  await createFanSession(fan.id);

  // Don't leak tokens to the client — only whether they're connected.
  return NextResponse.json({
    fan: {
      id: fan.id,
      username: fan.username,
      displayName: fan.displayName,
      hasSpotify: Boolean(fan.spotifyId),
      // Whether, not what. The full address never goes to the client.
      hasEmail: Boolean(fan.email),
      // Enough to recognise your own account, not enough to be worth
      // harvesting if somebody else ever got hold of the id.
      emailHint: fan.email ? mask(fan.email) : null,
    },
  });
}

/**
 * Attach an email address to a listener.
 *
 * The sign-in screen asks for one before anyone has heard a note, which is
 * the wrong moment to ask a stranger for anything. This is the other moment:
 * they have just kept a song and want it to still be there tomorrow. The
 * screen stays; this is in addition to it.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ fanId: string }> }
) {
  const gate = await allowRequest("fanEmail", req);
  if (!gate.allowed) {
    return tooManyRequests(gate.retryAfterSeconds, "Too many attempts. Try again shortly.");
  }

  const { fanId } = await params;
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  // Deliberately loose. A regex that rejects a valid-but-unusual address is a
  // listener lost; a typo is caught by the mail never arriving.
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }

  const fan = await prisma.fan.findUnique({ where: { id: fanId }, select: { id: true } });
  if (!fan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The column is unique, so an address already in use belongs to a different
  // listener with their own saves. Merging the two is Google sign-in's job,
  // which proves the address; we must not move saves on an unverified claim.
  const taken = await prisma.fan.findUnique({ where: { email }, select: { id: true } });
  if (taken && taken.id !== fanId) {
    return NextResponse.json(
      { error: "That address is already on another listener. Sign in with Google to bring your saves across." },
      { status: 409 }
    );
  }

  await prisma.fan.update({ where: { id: fanId }, data: { email, emailOptOut: false } });
  return NextResponse.json({ ok: true });
}
