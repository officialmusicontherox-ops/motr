import { prisma } from "./prisma";
import { leadersBetween } from "./scoutData";
import { weekOf } from "./weekWindow";
import { refreshProfile } from "./artistProfile";

/**
 * The Spotlight tab: six tiles, always.
 *
 * Paid slots first, then the week's leading artists to fill whatever is
 * left. Six slots at seven days needs six sales a week to stay full, which
 * will not happen at first, and a tab with four blank squares looks broken
 * and makes the filled ones look sad. The backfill means the tab is worth
 * opening from day one, and shows people what a Spotlight looks like, which
 * is the best advert for buying one.
 *
 * Nothing here is a verdict. The tab names the artist, so it is not blind
 * and by definition cannot reach the chart or the A&R figures.
 */

export const SLOTS = 6;
export const SPOTLIGHT_DAYS = 7;

/** Below this a listener count reads as a warning rather than momentum. */
export const LISTENER_THRESHOLD = 1500;

export type Tile = {
  artistId: string;
  name: string;
  genre: string | null;
  /** The artist's own photo, or the track artwork where there is none. */
  image: string | null;
  /** Null when below the threshold, so the tile simply omits it. */
  monthlyListeners: number | null;
  spotifyUrl: string | null;
  appleUrl: string | null;
  /** True for a bought slot, false for one filled from the chart. */
  paid: boolean;
};

type ArtistRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  monthlyListeners: number | null;
  spotifyArtistId: string | null;
  appleArtistUrl: string | null;
};

async function toTile(a: ArtistRow, paid: boolean): Promise<Tile> {
  // The fallback is the artwork of their newest live track, which is always
  // present, so a tile never renders as an empty box.
  const track = await prisma.track.findFirst({
    where: { artistId: a.id, status: { not: "REJECTED" } },
    select: { artworkUrl: true, genre: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    artistId: a.id,
    name: a.name,
    genre: track?.genre ?? null,
    image: a.photoUrl ?? track?.artworkUrl ?? null,
    monthlyListeners:
      a.monthlyListeners !== null && a.monthlyListeners >= LISTENER_THRESHOLD
        ? a.monthlyListeners
        : null,
    spotifyUrl: a.spotifyArtistId ? `https://open.spotify.com/artist/${a.spotifyArtistId}` : null,
    appleUrl: a.appleArtistUrl,
    paid,
  };
}

const SELECT = {
  id: true,
  name: true,
  photoUrl: true,
  monthlyListeners: true,
  spotifyArtistId: true,
  appleArtistUrl: true,
} as const;

/**
 * One artist, in the same shape a tile uses.
 *
 * Feeds the sheet that opens from a saved track, so what a listener sees
 * there is exactly what the Spotlight tab would show. The profile is
 * whatever was last fetched; nothing is read live, because this runs while
 * somebody is waiting on a tap.
 */
export async function artistCard(artistId: string): Promise<Tile | null> {
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: SELECT });
  if (!a) return null;
  return toTile(a, false);
}

export async function spotlightTiles(): Promise<Tile[]> {
  // Promote anything waiting first, so a slot that expired a minute ago is
  // already filled by the time this reads.
  await startSpotlights().catch(() => {});

  const now = new Date();

  const live = await prisma.spotlight.findMany({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    take: SLOTS,
    select: { artist: { select: SELECT } },
  });

  const tiles: Tile[] = [];
  const taken = new Set<string>();

  for (const s of live) {
    tiles.push(await toTile(s.artist, true));
    taken.add(s.artist.id);
  }

  if (tiles.length >= SLOTS) return tiles;

  // Fill the rest from the week's chart. An artist who is already in a paid
  // slot is skipped rather than shown twice.
  const week = weekOf();
  const leaders = await leadersBetween(week.start, week.end);
  const names = leaders.artists.map((a) => a.name).filter(Boolean);

  if (names.length > 0) {
    const rows = await prisma.artist.findMany({
      where: { name: { in: names }, id: { notIn: [...taken] }, emailOptOut: false },
      select: SELECT,
    });
    // Keep the chart's order rather than the database's.
    const byName = new Map(rows.map((r) => [r.name, r]));
    for (const n of names) {
      if (tiles.length >= SLOTS) break;
      const row = byName.get(n);
      if (!row || taken.has(row.id)) continue;
      tiles.push(await toTile(row, false));
      taken.add(row.id);
    }
  }

  // Still short, which happens in a quiet week: top up with artists who have
  // music in rotation, newest first, so the tab is never half empty.
  if (tiles.length < SLOTS) {
    const rest = await prisma.artist.findMany({
      where: {
        id: { notIn: [...taken] },
        emailOptOut: false,
        tracks: { some: { status: { not: "REJECTED" } } },
      },
      select: SELECT,
      orderBy: { createdAt: "desc" },
      take: SLOTS - tiles.length,
    });
    for (const r of rest) tiles.push(await toTile(r, false));
  }

  return tiles.slice(0, SLOTS);
}

/**
 * Create a Spotlight, and fetch that artist's profile while doing it.
 *
 * The profile is read here rather than when the tab renders, for two
 * reasons. Rendering six tiles would mean fifteen-odd sequential page reads
 * inside a function Netlify kills at ten seconds. And a background fetch
 * kicked off during a render often never finishes, because the function
 * freezes once it has responded.
 *
 * A purchase is the right moment: it happens once, somebody is waiting for
 * it anyway, and it only ever fetches for an artist who is actually going to
 * appear.
 *
 * A slot runs for seven days. Where all six are taken the row is created
 * with no dates and waits; startSpotlights gives it its seven days when one
 * frees, so nobody pays for time they lose.
 */
export async function createSpotlight(artistId: string, fanId?: string | null) {
  const now = new Date();
  const active = await prisma.spotlight.count({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
  });

  const starts = active < SLOTS ? now : null;
  const ends = starts ? new Date(starts.getTime() + SPOTLIGHT_DAYS * 24 * 60 * 60 * 1000) : null;

  const row = await prisma.spotlight.create({
    data: { artistId, fanId: fanId ?? null, startsAt: starts, endsAt: ends },
  });

  // Never let a profile read cost somebody their purchase. The tile falls
  // back to track artwork, which is always present.
  await refreshProfile(artistId).catch(() => {});

  return { spotlight: row, queued: starts === null };
}

/**
 * Give waiting Spotlights their seven days as slots free up.
 *
 * Called before the tab is read, so an expired slot is replaced the moment
 * somebody looks rather than when a timer happens to run.
 */
export async function startSpotlights() {
  const now = new Date();
  const active = await prisma.spotlight.count({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
  });
  const free = SLOTS - active;
  if (free <= 0) return 0;

  const waiting = await prisma.spotlight.findMany({
    where: { startsAt: null },
    orderBy: { createdAt: "asc" },
    take: free,
    select: { id: true },
  });

  for (const w of waiting) {
    await prisma.spotlight.update({
      where: { id: w.id },
      data: {
        startsAt: now,
        endsAt: new Date(now.getTime() + SPOTLIGHT_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  }
  return waiting.length;
}
