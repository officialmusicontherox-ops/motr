import { NextRequest, NextResponse } from "next/server";
import { weeklyLeaders } from "@/lib/scoutData";

/**
 * The public charts: what listeners backed hardest, over a week or a month.
 *
 * Never cached. A chart that shows yesterday's order is worse than no chart —
 * the reason an artist opens it is to see whether they moved, and a stale
 * answer reads as the app being broken.
 *
 * Counts are deliberately not returned. Rank is the useful part and the part
 * worth sharing; the raw numbers are small enough right now that printing
 * them would undercut the thing the chart is for.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  // Two windows, nothing else. A range picker with six options is a decision
  // nobody wants to make on a chart they opened to see one number.
  const days = req.nextUrl.searchParams.get("range") === "month" ? 30 : 7;
  const weekly = await weeklyLeaders(days);

  return NextResponse.json(
    {
      songs: weekly.songs.map((s, i) => ({
        rank: i + 1,
        id: s.id,
        title: s.title,
        artistName: s.artistName,
        artworkUrl: s.artworkUrl,
      })),
      artists: weekly.artists.map((a, i) => ({
        rank: i + 1,
        id: a.artistId,
        name: a.name,
        tracks: a.tracks,
      })),
      since: weekly.since,
      days,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
