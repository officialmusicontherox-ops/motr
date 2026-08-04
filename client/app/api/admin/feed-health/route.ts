import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { searchItunes } from "@/lib/trackLookup";

/**
 * Checks that every track in the feed still has audio behind it.
 *
 * Preview URLs rot. Deezer signs and expires them; even iTunes assets move.
 * When one dies the track stays in rotation and looks completely normal —
 * artwork, title, play button — it simply makes no sound, which a listener
 * reads as a broken app rather than a broken track. Fifty-eight went dead
 * overnight once and nothing in the dashboard showed it.
 *
 * Runs on demand rather than on a schedule: it makes one request per track,
 * which is fine occasionally and rude every few minutes.
 */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includeAll = req.nextUrl.searchParams.get("scope") === "all";

  const tracks = await prisma.track.findMany({
    where: includeAll ? {} : { status: "DISCOVERY" },
    select: { id: true, title: true, artistName: true, previewUrl: true, status: true },
  });

  const broken: { id: string; title: string; artistName: string; previewUrl: string }[] = [];

  // Ten at a time: fast enough to feel instant, gentle enough not to look
  // like an attack to Apple.
  for (let i = 0; i < tracks.length; i += 10) {
    const batch = tracks.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (t) => {
        try {
          // A range request fetches a few hundred bytes rather than the whole
          // clip — enough to know the file is really there.
          const res = await fetch(t.previewUrl, { headers: { Range: "bytes=0-500" } });
          return res.ok ? null : t;
        } catch {
          return t;
        }
      })
    );
    for (const r of results) if (r) broken.push(r);
  }

  return NextResponse.json({
    checked: tracks.length,
    playable: tracks.length - broken.length,
    broken,
    checkedAt: new Date().toISOString(),
  });
}

/**
 * Re-points a dead track at a working preview.
 *
 * iTunes only — its URLs are stable, where Deezer's are signed and expire.
 * That distinction is the whole reason this endpoint exists.
 */
export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { trackId } = await req.json().catch(() => ({}));
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  // Featured-artist tails hurt matching, so search on the plain title.
  const clean = track.title.replace(/\s*[([].*?[)\]]/g, "").trim();
  const found = await searchItunes(`${track.artistName} ${clean}`);

  if (!found?.previewUrl) {
    return NextResponse.json(
      {
        error:
          "Apple has no playable preview for this one. Pull it from the Tracks section, or ask the artist for a different release.",
      },
      { status: 404 }
    );
  }

  const updated = await prisma.track.update({
    where: { id: trackId },
    data: {
      previewUrl: found.previewUrl,
      artworkUrl:
        (found.artworkUrl100 ?? "").replace(/\/\d+x\d+bb\./, "/600x600bb.") || track.artworkUrl,
      durationMs: found.trackTimeMillis ?? track.durationMs,
    },
  });

  return NextResponse.json({ track: { id: updated.id, title: updated.title } });
}
