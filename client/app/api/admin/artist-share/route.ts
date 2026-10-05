import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { createArtistLoginToken } from "@/lib/artistLoginLink";
import { sendEmail, artistLoginLinkEmail } from "@/lib/email";
import { sendSharePageEmails } from "@/lib/artistSharePage";

/**
 * Who is actually promoting, and the two buttons that act on it.
 *
 * Share opens are the only number here that an artist controls. Saves follow
 * from the song itself, but opens only move when somebody posts a link, which
 * makes this the one view that says who is doing the work.
 */

const APP_URL = process.env.APP_URL ?? "https://app.musicontherox.com";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const artists = await prisma.artist.findMany({
    where: { tracks: { some: { status: { not: "REJECTED" } } } },
    select: {
      id: true,
      name: true,
      email: true,
      emailOptOut: true,
      sharePageEmailAt: true,
      tracks: {
        where: { status: { not: "REJECTED" } },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, shareOpens: true, fanRightSwipes: true },
      },
    },
  });

  const rows = artists
    .map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      optedOut: a.emailOptOut,
      told: a.sharePageEmailAt ? a.sharePageEmailAt.toISOString() : null,
      opens: a.tracks.reduce((t, x) => t + x.shareOpens, 0),
      saves: a.tracks.reduce((t, x) => t + x.fanRightSwipes, 0),
      tracks: a.tracks.map((t) => ({
        id: t.id,
        title: t.title,
        opens: t.shareOpens,
        saves: t.fanRightSwipes,
      })),
    }))
    // Loudest first: the artists bringing people are the ones worth knowing.
    .sort((a, b) => b.opens - a.opens || b.saves - a.saves);

  return NextResponse.json({
    artists: rows,
    totals: {
      opens: rows.reduce((t, r) => t + r.opens, 0),
      promoting: rows.filter((r) => r.opens > 0).length,
      untold: rows.filter((r) => !r.told && !r.optedOut).length,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, artistId } = await req.json().catch(() => ({}));

  // Sends an artist a fresh way into their own page, for when they ask.
  if (action === "SEND_LINK") {
    if (typeof artistId !== "string") {
      return NextResponse.json({ error: "artistId is required" }, { status: 400 });
    }
    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
      select: { email: true },
    });
    if (!artist) return NextResponse.json({ error: "No such artist." }, { status: 404 });

    const result = await createArtistLoginToken(artist.email);
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.reason === "throttled"
              ? "That artist has already been sent several links this hour."
              : "Couldn't make a link for that artist.",
        },
        { status: 400 }
      );
    }

    await sendEmail(
      result.email,
      artistLoginLinkEmail({
        name: result.name,
        url: `${APP_URL}/artist/verify?token=${encodeURIComponent(result.token)}`,
        minutes: 30,
      })
    );
    return NextResponse.json({ ok: true, sentTo: result.email });
  }

  // The one-off announcement. Only ever to artists who haven't had it.
  // The one-off announcement. Only ever to artists who haven't had it.
  if (action === "ANNOUNCE") {
    const result = await sendSharePageEmails();
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
