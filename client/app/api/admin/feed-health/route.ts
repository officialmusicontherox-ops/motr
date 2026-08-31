import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { searchItunes } from "@/lib/trackLookup";
import { knownMismatches, verifyFeedIdentity } from "@/lib/audioIdentity";

/**
 * Every request here is deliberately small.
 *
 * The host cuts a request off after about ten seconds, and this route talks
 * to Apple once per track — so a sweep of the whole library in one call gets
 * killed halfway and reports nothing. Both halves of the check therefore run
 * in slices, and the dashboard asks repeatedly until they are done.
 *
 * (An earlier `export const maxDuration = 60` lived here. That is a Vercel
 * directive and does nothing now — the cap is the platform's, not ours.)
 */
const PLAYABILITY_CHUNK = 40;

/**
 * Checks that every track in the feed still has audio behind it.
 *
 * Preview URLs rot. Deezer signs and expires them; even iTunes assets move.
 * When one dies the track stays in rotation and looks completely normal —
 * artwork, title, play button — it simply makes no sound, which a listener
 * reads as a broken app rather than a broken track. Fifty-eight went dead
 * overnight once and nothing in the dashboard showed it.
 *
 * Runs on demand rather than on a schedule: the playability sweep makes one
 * request per track, which is fine occasionally and rude every few minutes.
 */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const includeAll = params.get("scope") === "all";

  // Identity is its own phase. It costs a rate-limited Apple search per
  // unknown track, so it is budgeted separately and asked for repeatedly.
  if (params.get("identityOnly") === "1" || params.get("phase") === "identity") {
    const identity = await verifyFeedIdentity(params.get("recheck") === "all");
    return NextResponse.json({
      phase: "identity",
      identity: { ...identity, mismatches: await knownMismatches() },
      checkedAt: new Date().toISOString(),
    });
  }

  // Playability, one slice at a time. The caller walks the offset forward
  // until nextOffset comes back null.
  const where = includeAll ? {} : { status: "DISCOVERY" as const };
  const offset = Math.max(0, Number(params.get("offset") ?? 0) || 0);

  const [total, tracks] = await Promise.all([
    prisma.track.count({ where }),
    prisma.track.findMany({
      where,
      select: { id: true, title: true, artistName: true, previewUrl: true, status: true },
      // A stable order matters more than a useful one: the caller is paging
      // through by offset, and rows shifting between calls would let a track
      // slip past unchecked.
      orderBy: { id: "asc" },
      skip: offset,
      take: PLAYABILITY_CHUNK,
    }),
  ]);

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

  const nextOffset = offset + tracks.length;

  return NextResponse.json({
    phase: "playable",
    total,
    checked: tracks.length,
    playable: tracks.length - broken.length,
    broken,
    nextOffset: nextOffset < total && tracks.length > 0 ? nextOffset : null,
    checkedAt: new Date().toISOString(),
  });
}


/**
 * Re-points a dead track at a working preview.
 *
 * iTunes first, because its links are permanent. Deezer's are signed and
 * expire within about a day — storing one only buys a track that plays
 * today and is silent tomorrow, which is precisely how the feed broke.
 *
 * Deezer's exact id is still the better *lookup* when Apple genuinely
 * hasn't got the recording, so it stays as a fallback. The response says
 * which was used, because a Deezer repair is temporary and the caller
 * deserves to know that.
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
    // Apple hasn't got it. Deezer's exact id will, but that link expires,
    // so it's a stopgap and the response says so.
    const deezerId = track.externalId.startsWith("deezer-")
      ? track.externalId.slice("deezer-".length)
      : null;

    if (deezerId) {
      try {
        const res = await fetch(`https://api.deezer.com/track/${deezerId}`);
        if (res.ok) {
          const d = (await res.json()) as { preview?: string; duration?: number };
          if (d.preview) {
            const updated = await prisma.track.update({
              where: { id: trackId },
              data: {
                previewUrl: d.preview,
                durationMs: d.duration ? d.duration * 1000 : track.durationMs,
                audioVerdict: null,
                audioCheckedAt: null,
              },
            });
            return NextResponse.json({
              track: { id: updated.id, title: updated.title },
              via: "deezer",
              temporary: true,
            });
          }
        }
      } catch {
        // Fall through to the error below.
      }
    }

    return NextResponse.json(
      {
        error:
          "Neither Apple nor Deezer has a playable preview for this one. Paste an iTunes link below, or pull it from the Tracks section.",
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
      // New audio is a new claim, so it has to earn its verdict again.
      audioVerdict: null,
      audioCheckedAt: null,
    },
  });

  return NextResponse.json({ track: { id: updated.id, title: updated.title }, via: "itunes" });
}
