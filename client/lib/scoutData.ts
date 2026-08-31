import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { FULL_LISTEN_MS } from "./discovery";

/**
 * What the A&R portal shows.
 *
 * The pitch is not "here are their Spotify numbers" — anyone can buy those,
 * and better. It is the thing only a blind-swipe platform can know: how a
 * record performs when nobody knows who made it, how far in people get before
 * they decide, and where it starts catching.
 *
 * Deliberately excluded: anything identifying a listener. A scout sees that a
 * track is landing in Texas, never who is in Texas.
 */

/** Under this many verdicts, a rate is noise and is labelled as such. */
export const CONFIDENCE_FLOOR = 20;

export type ScoutTrack = {
  id: string;
  title: string;
  artistName: string;
  genre: string | null;
  artworkUrl: string | null;
  rightSwipes: number;
  leftSwipes: number;
  totalSwipes: number;
  /** Share of verdicts that were saves. Null below the confidence floor. */
  saveRate: number | null;
  /** Share who heard the clip out before deciding — held attention. */
  fullListenRate: number | null;
  /** Median milliseconds before a verdict. Where people make their mind up. */
  medianDecisionMs: number | null;
  firstSwipeAt: string | null;
  lastSwipeAt: string | null;
  topCountries: { name: string; swipes: number }[];
  topRegions: { name: string; swipes: number }[];
};

type Row = {
  id: string;
  title: string;
  artistName: string;
  genre: string | null;
  artworkUrl: string | null;
  right_swipes: bigint;
  left_swipes: bigint;
  full_listens: bigint;
  with_listen: bigint;
  median_ms: number | null;
  first_swipe: Date | null;
  last_swipe: Date | null;
};

/**
 * The catalogue with its blind-test numbers.
 *
 * One query rather than one per track: at a few hundred tracks the difference
 * is invisible, at a few thousand it is the difference between a page and a
 * timeout, and this is the page a paying customer looks at first.
 */
export async function scoutCatalogue(params?: {
  genre?: string | null;
  sort?: "saveRate" | "swipes" | "recent";
  limit?: number;
}): Promise<ScoutTrack[]> {
  const genre = params?.genre?.trim() || null;
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);

  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT
      t."id", t."title", t."artistName", t."genre", t."artworkUrl",
      COUNT(*) FILTER (WHERE s."direction" = 'RIGHT')::bigint AS right_swipes,
      COUNT(*) FILTER (WHERE s."direction" = 'LEFT')::bigint  AS left_swipes,
      COUNT(*) FILTER (WHERE s."listenMs" >= ${FULL_LISTEN_MS})::bigint AS full_listens,
      COUNT(*) FILTER (WHERE s."listenMs" IS NOT NULL)::bigint AS with_listen,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s."listenMs")::float AS median_ms,
      MIN(s."createdAt") AS first_swipe,
      MAX(s."createdAt") AS last_swipe
    FROM "Track" t
    LEFT JOIN "FanSwipe" s ON s."trackId" = t."id"
    WHERE t."status" <> 'REJECTED'
      -- Submissions only. Tracks with no artist behind them are the seeded
      -- catalogue: major-label records that exist so a new listener has
      -- something to swipe. A scout is here to find people who aren't signed
      -- yet, and showing them how Kacey Musgraves performs is both useless
      -- and a fair reason to doubt everything else on the page.
      AND t."artistId" IS NOT NULL
      ${genre ? Prisma.sql`AND t."genre" = ${genre}` : Prisma.empty}
    GROUP BY t."id"
    HAVING COUNT(s."id") > 0
    ORDER BY MAX(s."createdAt") DESC NULLS LAST
    LIMIT ${limit}
  `);

  const ids = rows.map((r) => r.id);
  const [countries, regions] = await Promise.all([
    geographyFor(ids, "countryName"),
    geographyFor(ids, "region"),
  ]);

  const tracks: ScoutTrack[] = rows.map((r) => {
    const right = Number(r.right_swipes);
    const left = Number(r.left_swipes);
    const total = right + left;
    const withListen = Number(r.with_listen);

    return {
      id: r.id,
      title: r.title,
      artistName: r.artistName,
      genre: r.genre,
      artworkUrl: r.artworkUrl,
      rightSwipes: right,
      leftSwipes: left,
      totalSwipes: total,
      // Below the floor a rate is one or two people's opinion wearing a
      // percentage sign. Null so the UI can say "too early" rather than
      // print 100% and be believed.
      saveRate: total >= CONFIDENCE_FLOOR ? right / total : null,
      fullListenRate:
        withListen >= CONFIDENCE_FLOOR ? Number(r.full_listens) / withListen : null,
      medianDecisionMs: r.median_ms === null ? null : Math.round(r.median_ms),
      firstSwipeAt: r.first_swipe ? r.first_swipe.toISOString() : null,
      lastSwipeAt: r.last_swipe ? r.last_swipe.toISOString() : null,
      topCountries: countries.get(r.id) ?? [],
      topRegions: regions.get(r.id) ?? [],
    };
  });

  const sort = params?.sort ?? "recent";
  if (sort === "saveRate") {
    // Unrated tracks sink rather than floating to the top on a null.
    tracks.sort((a, b) => (b.saveRate ?? -1) - (a.saveRate ?? -1));
  } else if (sort === "swipes") {
    tracks.sort((a, b) => b.totalSwipes - a.totalSwipes);
  }

  return tracks;
}

/**
 * Where each track's swipes came from, top few places only.
 *
 * City is captured but not surfaced: at this volume a city can be one person,
 * and "who saved this" is not something a scout gets to know.
 */
async function geographyFor(
  trackIds: string[],
  column: "countryName" | "region"
): Promise<Map<string, { name: string; swipes: number }[]>> {
  const out = new Map<string, { name: string; swipes: number }[]>();
  if (trackIds.length === 0) return out;

  const field = column === "countryName" ? Prisma.sql`"countryName"` : Prisma.sql`"region"`;

  const rows = await prisma.$queryRaw<{ trackId: string; name: string; n: bigint }[]>(Prisma.sql`
    SELECT "trackId", ${field} AS name, COUNT(*)::bigint AS n
    FROM "FanSwipe"
    WHERE "trackId" IN (${Prisma.join(trackIds)})
      AND ${field} IS NOT NULL
    GROUP BY "trackId", ${field}
    ORDER BY "trackId", n DESC
  `);

  for (const row of rows) {
    const list = out.get(row.trackId) ?? [];
    if (list.length < 4) list.push({ name: row.name, swipes: Number(row.n) });
    out.set(row.trackId, list);
  }
  return out;
}

/** Headline numbers for the top of the portal. */
export async function scoutSummary() {
  const [tracks, swipes, geoRows, genres] = await Promise.all([
    prisma.track.count({ where: { status: { not: "REJECTED" }, artistId: { not: null } } }),
    prisma.fanSwipe.count({ where: { track: { artistId: { not: null } } } }),
    prisma.$queryRaw<{ name: string; n: bigint }[]>(Prisma.sql`
      SELECT s."countryName" AS name, COUNT(*)::bigint AS n
      FROM "FanSwipe" s
      JOIN "Track" t ON t."id" = s."trackId"
      WHERE s."countryName" IS NOT NULL AND t."artistId" IS NOT NULL
      GROUP BY s."countryName" ORDER BY n DESC LIMIT 8
    `),
    prisma.track.findMany({
      where: { status: { not: "REJECTED" }, artistId: { not: null }, genre: { not: null } },
      select: { genre: true },
      distinct: ["genre"],
      orderBy: { genre: "asc" },
    }),
  ]);

  return {
    tracks,
    swipes,
    countries: geoRows.map((r) => ({ name: r.name, swipes: Number(r.n) })),
    genres: genres.map((g) => g.genre).filter((g): g is string => Boolean(g)),
  };
}
