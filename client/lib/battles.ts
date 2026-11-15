import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { spotifyLinkFor } from "./spotifyLink";

/**
 * Battles: two blind songs from one genre, and the listener picks one.
 *
 * A swipe is a judgment against whatever bar that listener happens to hold,
 * so a save rate measures the listener as much as the song. A battle has no
 * bar to set. It is a second verdict on the music that owes nothing to the
 * first, which is why it keeps its own ranking and never touches the chart,
 * the weekly winner or anything an artist is judged by elsewhere.
 *
 * Four rules make it fair:
 *  - Same genre, so the vote is about the songs and not about which genre
 *    somebody prefers.
 *  - Never two songs by the same artist, who would otherwise collect a win
 *    whatever happened.
 *  - Songs with the fewest battles are picked first, so a raw win count
 *    stays comparable without printing a percentage beside it.
 *  - A listener meets each song once, so every vote is a first impression.
 *
 * Only songs an artist submitted take part. The seeded catalogue stays out,
 * so every win on the board belongs to a MOTR artist.
 */

/**
 * Who an artist is, for the purposes of a battle.
 *
 * The same key the charts group on: Apple's own profile id for the primary
 * artist, falling back to the credited name. Never the submitting account,
 * because a manager or label posts several artists from one login.
 */
const KEY = (alias: string) =>
  Prisma.raw(`COALESCE(${alias}."appleArtistId", 'name:' || ${alias}."artistName")`);

const seenBy = (alias: string, fanId: string) => Prisma.sql`
  EXISTS (
    SELECT 1 FROM "Battle" b
    WHERE b."fanId" = ${fanId}
      AND (b."trackAId" = ${Prisma.raw(alias)}."id" OR b."trackBId" = ${Prisma.raw(alias)}."id")
  )`;

const eligible = (alias: string, excludeAi: boolean) => Prisma.sql`
  ${Prisma.raw(alias)}."status" = 'DISCOVERY'::"TrackStatus"
  AND ${Prisma.raw(alias)}."artistId" IS NOT NULL
  AND ${Prisma.raw(alias)}."genre" IS NOT NULL
  ${
    excludeAi
      ? Prisma.sql`AND (${Prisma.raw(alias)}."aiGenerated" IS NULL OR ${Prisma.raw(alias)}."aiGenerated" = false)`
      : Prisma.empty
  }`;

/** What the screen is given before a vote. Nothing that names anybody. */
export type OpenBattle = {
  id: string;
  genre: string;
  a: { previewUrl: string };
  b: { previewUrl: string };
};

type Side = {
  title: string;
  artistName: string;
  artworkUrl: string | null;
  spotifyUrl: string;
  /** Everything this artist has ever won, across all their songs. */
  wins: number;
};

export type Reveal = { winner: "A" | "B"; a: Side; b: Side };

export class BattleGoneError extends Error {
  constructor() {
    super("That battle is not open");
    this.name = "BattleGoneError";
  }
}

async function shape(battle: { id: string; genre: string; trackAId: string; trackBId: string }) {
  const tracks = await prisma.track.findMany({
    where: { id: { in: [battle.trackAId, battle.trackBId] }, status: "DISCOVERY" },
    select: { id: true, previewUrl: true },
  });
  const a = tracks.find((t) => t.id === battle.trackAId);
  const b = tracks.find((t) => t.id === battle.trackBId);
  if (!a || !b) return null;
  return {
    id: battle.id,
    genre: battle.genre,
    a: { previewUrl: a.previewUrl },
    b: { previewUrl: b.previewUrl },
  } satisfies OpenBattle;
}

/**
 * The listener's next battle, or null when there is nothing left to pair.
 *
 * A battle that was served and never answered is handed back rather than
 * replaced. Otherwise leaving the tab and coming back would burn two songs
 * the listener never judged.
 */
export async function nextBattle(fanId: string, excludeAi: boolean): Promise<OpenBattle | null> {
  const open = await prisma.battle.findFirst({
    where: { fanId, decidedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (open) {
    const ready = await shape(open);
    if (ready) return ready;
    // One of the two was pulled from the feed while it sat open. Close it
    // as a skip, which counts for nobody.
    await prisma.battle.update({ where: { id: open.id }, data: { decidedAt: new Date() } });
  }

  // Fewest battles first, random among equals. The EXISTS makes sure the
  // song chosen actually has somebody to face, so a genre with one artist
  // in it is passed over instead of ending the tab.
  const first = await prisma.$queryRaw<Array<{ id: string; genre: string }>>(Prisma.sql`
    SELECT t."id", t."genre"
    FROM "Track" t
    WHERE ${eligible("t", excludeAi)}
      AND NOT ${seenBy("t", fanId)}
      AND EXISTS (
        SELECT 1 FROM "Track" o
        WHERE ${eligible("o", excludeAi)}
          AND o."genre" = t."genre"
          AND o."id" <> t."id"
          AND ${KEY("o")} <> ${KEY("t")}
          AND LOWER(o."artistName") <> LOWER(t."artistName")
          AND NOT ${seenBy("o", fanId)}
      )
    ORDER BY t."battles" ASC, RANDOM()
    LIMIT 1
  `);
  if (first.length === 0) return null;

  const second = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT o."id"
    FROM "Track" o, "Track" t
    WHERE t."id" = ${first[0].id}
      AND ${eligible("o", excludeAi)}
      AND o."genre" = t."genre"
      AND o."id" <> t."id"
      AND ${KEY("o")} <> ${KEY("t")}
      AND LOWER(o."artistName") <> LOWER(t."artistName")
      AND NOT ${seenBy("o", fanId)}
    ORDER BY o."battles" ASC, RANDOM()
    LIMIT 1
  `);
  if (second.length === 0) return null;

  // Which one goes on the left is a coin toss, so the side of the screen
  // people favour cannot favour a song.
  const [trackAId, trackBId] =
    Math.random() < 0.5 ? [first[0].id, second[0].id] : [second[0].id, first[0].id];

  const battle = await prisma.battle.create({
    data: { fanId, trackAId, trackBId, genre: first[0].genre },
  });
  return shape(battle);
}

/** Everything the artists behind these songs have won, keyed like the charts. */
async function winsFor(trackIds: string[]) {
  const rows = await prisma.$queryRaw<Array<{ id: string; wins: number }>>(Prisma.sql`
    SELECT t."id",
           (
             SELECT COALESCE(SUM(x."battleWins"), 0)::int
             FROM "Track" x
             WHERE ${KEY("x")} = ${KEY("t")}
           ) AS wins
    FROM "Track" t
    WHERE t."id" IN (${Prisma.join(trackIds)})
  `);
  return new Map(rows.map((r) => [r.id, Number(r.wins)]));
}

/**
 * Record the listener's answer.
 *
 * The battle is claimed with a conditional update before anything is
 * counted, so two taps landing together cannot award the win twice. A skip
 * closes the battle and counts for nobody; it returns no reveal, because
 * the reveal is what a vote earns.
 */
export async function decideBattle(
  fanId: string,
  battleId: string,
  pick: "A" | "B" | "SKIP"
): Promise<Reveal | null> {
  const battle = await prisma.battle.findUnique({ where: { id: battleId } });
  if (!battle || battle.fanId !== fanId) throw new BattleGoneError();

  const winnerId = pick === "A" ? battle.trackAId : pick === "B" ? battle.trackBId : null;
  const loserId = pick === "A" ? battle.trackBId : pick === "B" ? battle.trackAId : null;

  const claimed = await prisma.battle.updateMany({
    where: { id: battleId, fanId, decidedAt: null },
    data: { decidedAt: new Date(), winnerId },
  });
  if (claimed.count === 0) throw new BattleGoneError();

  if (!winnerId || !loserId) return null;

  await prisma.$transaction([
    prisma.track.update({
      where: { id: winnerId },
      data: { battles: { increment: 1 }, battleWins: { increment: 1 } },
    }),
    prisma.track.update({ where: { id: loserId }, data: { battles: { increment: 1 } } }),
  ]);

  const tracks = await prisma.track.findMany({
    where: { id: { in: [battle.trackAId, battle.trackBId] } },
    select: {
      id: true,
      title: true,
      artistName: true,
      artworkUrl: true,
      externalId: true,
      source: true,
    },
  });
  const wins = await winsFor([battle.trackAId, battle.trackBId]);

  const side = (id: string): Side => {
    const t = tracks.find((x) => x.id === id)!;
    return {
      title: t.title,
      // The credited name, featured artists and all. Wins are grouped by
      // the primary artist, but the song is shown as it was released.
      artistName: t.artistName,
      artworkUrl: t.artworkUrl,
      spotifyUrl: spotifyLinkFor(t),
      wins: wins.get(id) ?? 0,
    };
  };

  return { winner: pick as "A" | "B", a: side(battle.trackAId), b: side(battle.trackBId) };
}

export type BattleLeader = { key: string; name: string; wins: number };

/**
 * Battle Wins between two dates, by artist.
 *
 * Counted from the dated Battle rows rather than from the counters on
 * Track, so the same query answers a week, a month or any week gone by.
 * Grouped the way the artist chart is, so a name on one board is the same
 * artist on the other.
 */
export async function battleLeadersBetween(
  start: Date,
  end: Date,
  limit = 10
): Promise<BattleLeader[]> {
  // Ties go to whoever got there first, so the order does not shuffle
  // between two looks at the same chart.
  const rows = await prisma.$queryRaw<Array<{ key: string; name: string; wins: number }>>(Prisma.sql`
    SELECT ${KEY("t")} AS key,
           MAX(COALESCE(t."appleArtistName", t."artistName")) AS name,
           COUNT(*)::int AS wins
    FROM "Battle" b
    JOIN "Track" t ON t."id" = b."winnerId"
    WHERE b."decidedAt" >= ${start}
      AND b."decidedAt" < ${end}
      AND t."status" <> 'REJECTED'::"TrackStatus"
    GROUP BY 1
    ORDER BY wins DESC, MIN(b."decidedAt") ASC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ key: r.key, name: r.name, wins: Number(r.wins) }));
}

/** The complete record, for the admin panel: every artist, all time. */
export async function battleTotals(limit = 200) {
  const rows = await prisma.$queryRaw<
    Array<{ key: string; name: string; wins: number; battles: number }>
  >(Prisma.sql`
    SELECT ${KEY("t")} AS key,
           MAX(COALESCE(t."appleArtistName", t."artistName")) AS name,
           SUM(t."battleWins")::int AS wins,
           SUM(t."battles")::int AS battles
    FROM "Track" t
    WHERE t."artistId" IS NOT NULL
    GROUP BY 1
    HAVING SUM(t."battles") > 0
    ORDER BY wins DESC, battles ASC, name ASC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    wins: Number(r.wins),
    battles: Number(r.battles),
  }));
}
