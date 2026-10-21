import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFanSession } from "@/lib/fanAuth";

/**
 * Who the caller is, according to their cookie.
 *
 * Exists so an id never has to travel in a URL. Sign-in used to redirect to
 * /?fan=<id>, which put the id in browser history, in the referrer of
 * anything the page then loaded, and in any log that recorded the address.
 * The cookie is already set by the time this is called, so the page can ask
 * who it is rather than being told in a query string.
 */
export async function GET() {
  const fanId = await getFanSession();
  if (!fanId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const fan = await prisma.fan.findUnique({
    where: { id: fanId },
    select: { id: true, username: true, displayName: true, spotifyId: true, email: true },
  });
  if (!fan) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  return NextResponse.json({
    fan: {
      id: fan.id,
      username: fan.username,
      displayName: fan.displayName,
      hasSpotify: Boolean(fan.spotifyId),
      // Whether, not what.
      hasEmail: Boolean(fan.email),
    },
  });
}
