import { prisma } from "./prisma";
import { leadersBetween } from "./scoutData";
import { weekOf } from "./weekWindow";
import { refreshProfile } from "./artistProfile";
import { SLOTS, SPOTLIGHT_DAYS, PER_ARTIST } from "./spotlightBundles";

export { SLOTS, SPOTLIGHT_DAYS, PER_ARTIST };

const RUN_MS = SPOTLIGHT_DAYS * 24 * 60 * 60 * 1000;

/** How many tiles this artist is holding right now. */
async function liveFor(artistId: string, now: Date) {
  return prisma.spotlight.count({
    where: { artistId, startsAt: { lte: now }, endsAt: { gt: now } },
  });
}

/**
 * The Spotlight tab: six tiles, always.
 *
 * Paid slots first, then the week's leading artists to fill whatever is
 * left. Six slots needs a sale every half day to stay full, which
 * will not happen at first, and a tab with four blank squares looks broken
 * and makes the filled ones look sad. The backfill means the tab is worth
 * opening from day one, and shows people what a Spotlight looks like, which
 * is the best advert for buying one.
 *
 * Nothing here is a verdict. The tab names the artist, so it is not blind
 * and by definition cannot reach the chart or the A&R figures.
 */

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
    // No dedupe on purpose. Spending two Spotlights on one artist is a
    // choice the buyer paid for, and a tile is three days, so it corrects
    // itself. The backfill below still skips anyone already up.
    tiles.push(await toTile(s.artist, true));
    taken.add(s.artist.id);
  }

  if (tiles.length >= SLOTS) return tiles;

  // Fill the rest from the week's Top Artists chart. An artist who is already in a paid
  // slot is skipped rather than shown twice.
  const week = weekOf();
  const leaders = await leadersBetween(week.start, week.end);
  // Top Artists only. The AI Artists chart never fills a Spotlight place;
  // an AI artist is in the Spotlight only when a listener puts them there.
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
 * A slot runs for SPOTLIGHT_DAYS. Where all six are taken the row is
 * created with no dates and waits; startSpotlights gives it its full run
 * when one frees, so nobody pays for time they lose.
 */
export async function createSpotlight(
  artistId: string,
  fanId?: string | null,
  trackId?: string | null
) {
  const now = new Date();
  const active = await prisma.spotlight.count({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
  });

  /**
   * Two tiles each, at most.
   *
   * Six tiles and no cap means one buyer owns the shelf: on 14 Nov 2026 two
   * artists held all six between them, four and two, and the buyer with
   * four still had credits in hand. A cap of two still leaves a dominant
   * position for anyone who wants it while guaranteeing at least three
   * different artists are showing.
   *
   * Nothing is lost by hitting the cap. The Spotlight queues and takes its
   * full run when one of that artist's own tiles expires, so the same time
   * is served over more days rather than stacked on top of itself.
   */
  const mine = await liveFor(artistId, now);
  const starts = active < SLOTS && mine < PER_ARTIST ? now : null;
  const ends = starts ? new Date(starts.getTime() + RUN_MS) : null;

  const row = await prisma.spotlight.create({
    data: {
      artistId,
      fanId: fanId ?? null,
      trackId: trackId ?? null,
      startsAt: starts,
      endsAt: ends,
    },
  });

  // Never let a profile read cost somebody their purchase. The tile falls
  // back to track artwork, which is always present.
  await refreshProfile(artistId).catch(() => {});

  return { spotlight: row, queued: starts === null };
}

/**
 * Give waiting Spotlights their run as slots free up.
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

  /**
   * Oldest first, but skipping anyone already holding their two.
   *
   * Taking the head of the queue blindly would let one artist's backlog
   * block everybody else's: with four waiting for the same name, nothing
   * else would ever be promoted.
   */
  const waiting = await prisma.spotlight.findMany({
    where: { startsAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, artistId: true, remainingMs: true },
  });

  // Counted once and kept up to date as this loop promotes, rather than a
  // query per candidate.
  const held = new Map<string, number>();
  let promoted = 0;

  for (const w of waiting) {
    if (promoted >= free) break;
    if (!held.has(w.artistId)) held.set(w.artistId, await liveFor(w.artistId, now));
    if ((held.get(w.artistId) ?? 0) >= PER_ARTIST) continue;

    // A run that was put back in the queue resumes with what it had left.
    const run = w.remainingMs && w.remainingMs > 0 ? w.remainingMs : RUN_MS;
    await prisma.spotlight.update({
      where: { id: w.id },
      data: {
        startsAt: now,
        endsAt: new Date(now.getTime() + run),
        remainingMs: null,
      },
    });
    held.set(w.artistId, (held.get(w.artistId) ?? 0) + 1);
    promoted++;
  }
  return promoted;
}


export class NoCreditsError extends Error {
  constructor() {
    super("No Spotlights left");
    this.name = "NoCreditsError";
  }
}

/**
 * Spend one of a listener's Spotlights on an artist.
 *
 * The decrement is a conditional update rather than a read then a write: two
 * taps landing together on the last credit would both pass a read-first
 * check and hand out two Spotlights for one. `updateMany` with the balance
 * in the where clause either matches a row or does not, so the second one
 * loses and is told it has none left.
 *
 * The slot is created after the credit is taken, and on the rare failure
 * after that point the credit is handed back, because a listener who paid
 * and got nothing is the one outcome worth writing extra code to avoid.
 */
export async function spendCredit(fanId: string, artistId: string, trackId?: string | null) {
  const taken = await prisma.fan.updateMany({
    where: { id: fanId, spotlightCredits: { gte: 1 } },
    data: { spotlightCredits: { decrement: 1 } },
  });
  if (taken.count === 0) throw new NoCreditsError();

  try {
    const { queued } = await createSpotlight(artistId, fanId, trackId ?? null);
    const fan = await prisma.fan.findUnique({
      where: { id: fanId },
      select: { spotlightCredits: true },
    });
    return { queued, left: fan?.spotlightCredits ?? 0 };
  } catch (e) {
    await prisma.fan
      .update({ where: { id: fanId }, data: { spotlightCredits: { increment: 1 } } })
      .catch(() => {});
    throw e;
  }
}

/** How many Spotlights this listener is holding. */
export async function creditsFor(fanId: string) {
  const fan = await prisma.fan.findUnique({
    where: { id: fanId },
    select: { spotlightCredits: true },
  });
  return fan?.spotlightCredits ?? 0;
}
