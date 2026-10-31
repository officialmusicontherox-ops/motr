import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { optOutArtist, optInArtist, optOutFan, optInFan } from "@/lib/optOut";

/**
 * Who has unsubscribed, and unsubscribing someone who asked by email.
 *
 * People do not always use the link. They reply to the email asking to be
 * taken off, and until now that meant editing a row by hand. Honouring the
 * request quickly matters, so it belongs in the dashboard.
 */

type Row = {
  kind: "artist" | "listener";
  id: string;
  name: string;
  email: string;
  at: string | null;
  by: string | null;
};

/** Both audiences, newest first. */
async function recentOptOuts(limit = 40): Promise<Row[]> {
  const [artists, fans] = await Promise.all([
    prisma.artist.findMany({
      where: { emailOptOut: true },
      select: { id: true, name: true, email: true, emailOptOutAt: true, emailOptOutBy: true },
      orderBy: [{ emailOptOutAt: { sort: "desc", nulls: "last" } }],
      take: limit,
    }),
    prisma.fan.findMany({
      where: { emailOptOut: true, email: { not: null } },
      select: { id: true, username: true, email: true, emailOptOutAt: true, emailOptOutBy: true },
      orderBy: [{ emailOptOutAt: { sort: "desc", nulls: "last" } }],
      take: limit,
    }),
  ]);

  const rows: Row[] = [
    ...artists.map((a) => ({
      kind: "artist" as const,
      id: a.id,
      name: a.name,
      email: a.email,
      at: a.emailOptOutAt?.toISOString() ?? null,
      by: a.emailOptOutBy,
    })),
    ...fans.map((f) => ({
      kind: "listener" as const,
      id: f.id,
      name: f.username,
      email: f.email as string,
      at: f.emailOptOutAt?.toISOString() ?? null,
      by: f.emailOptOutBy,
    })),
  ];

  // Undated ones are historic, so they sort below everything with a date
  // rather than jumbling into the recent news.
  rows.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  return rows.slice(0, limit);
}

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = (req.nextUrl.searchParams.get("email") ?? "").trim();
  const rows = await recentOptOuts();

  // New in the last three days, which is what the badge counts.
  const since = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const fresh = rows.filter((r) => r.at && Date.parse(r.at) > since).length;

  if (!email) return NextResponse.json({ rows, fresh, match: null });

  // One address can be both an artist and a listener, and a request to be
  // taken off means both, so the search reports each separately.
  const [artist, fan] = await Promise.all([
    prisma.artist.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, name: true, email: true, emailOptOut: true, emailOptOutAt: true },
    }),
    prisma.fan.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, username: true, email: true, emailOptOut: true, emailOptOutAt: true },
    }),
  ]);

  return NextResponse.json({
    rows,
    fresh,
    match: {
      email,
      artist: artist
        ? { id: artist.id, name: artist.name, optedOut: artist.emailOptOut,
            at: artist.emailOptOutAt?.toISOString() ?? null }
        : null,
      listener: fan
        ? { id: fan.id, name: fan.username, optedOut: fan.emailOptOut,
            at: fan.emailOptOutAt?.toISOString() ?? null }
        : null,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, subscribe } = await req.json().catch(() => ({}) as Record<string, unknown>);
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "An email address is required." }, { status: 400 });
  }

  const optOut = subscribe !== true;

  // Matched case-insensitively because an address typed into a reply rarely
  // matches the case it was signed up with. One address can be both.
  const [artist, fan] = await Promise.all([
    prisma.artist.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    }),
    prisma.fan.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    }),
  ]);

  if (!artist && !fan) {
    return NextResponse.json(
      { error: `No artist or listener has the address ${email}.` },
      { status: 404 }
    );
  }

  // The same helpers the unsubscribe link uses, so an artist taken off here
  // loses their rotation exactly as one who clicked the link does.
  let tracks = 0;
  if (artist) {
    const r = optOut ? await optOutArtist(artist.id, "admin") : await optInArtist(artist.id);
    tracks = "tracksPulled" in r ? r.tracksPulled : r.tracksRestored;
  }
  if (fan) {
    await (optOut ? optOutFan(fan.id, "admin") : optInFan(fan.id));
  }

  return NextResponse.json({
    ok: true,
    email,
    optedOut: optOut,
    artists: artist ? 1 : 0,
    listeners: fan ? 1 : 0,
    tracks,
  });
}
