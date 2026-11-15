import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { spotifyLinkFor } from "./spotifyLink";
import { weekOf } from "./weekWindow";

/**
 * Battles: two blind songs from one genre, and the listener picks one.
 *
 * A swipe is a judgment against whatever bar that listener happens to hold,
 * so a save rate measures the listener as much as the song. A battle has no
 * bar to set. It is a second verdict on the music that owes nothing to the
 * first, which is why it keeps its own ranking and never touches the chart,
 * the weekly winner or anything an artist is judged by elsewhere.
 *
 * Every listener gets the same pairs. Random pairs per listener do add up to
 * a fair ranking, but no single battle ever has a result: nobody can say
 * they won, there is nothing to share, and an artist has nowhere to send
 * people. A shared battle has a score, an end and a winner.
 *
 * The rules:
 *  - A battle belongs to a chart week, Sunday to Saturday Central, and
 *    closes with it however late in the week it was paired.
 *  - Same genre, so the vote is about the songs and not the genre.
 *  - AI vocals face AI vocals, so a listener who hides them loses nothing
 *    else, and no human singer's battle is hidden along with them.
 *  - One battle per artist per week. A bigger catalogue cannot win more,
 *    an artist's supporters vote in one place, and each battle gets more
 *    of the votes there are.
 *  - Never two songs by the same artist, by definition of the above.
 *  - One vote per listener per battle, enforced by the database.
 *
 * Only songs an artist submitted take part. The seeded catalogue stays out,
 * so every win on the board belongs to a MOTR artist.
 */

/**
 * The week a battle belongs to.
 *
 * The chart week, Sunday to Saturday Central, with one exception. Battles
 * launched on the evening of Saturday 14 November 2026, hours before that
 * week closed, and a battle that opens and shuts the same night is not a
 * battle. So launch night counts as part of the first full week: the first
 * set runs a week and a day, closes on Saturday 21 November, and every week
 * after that is an ordinary one.
 */
const FIRST_WEEK = weekOf(new Date("2026-11-16T00:00:00Z"));

export function battleWeek(at: Date = new Date()) {
  return at.getTime() < FIRST_WEEK.start.getTime() ? FIRST_WEEK : weekOf(at);
}

/** Battles one artist can be in during a week. */
export const PER_ARTIST_PER_WEEK = 1;

/**
 * Votes a battle needs before its split is shown.
 *
 * One vote reads as 100% to 0%, which looks decided and is nothing of the
 * kind. Below this the screen says voting is open and leaves it there.
 */
export const MIN_VOTES_TO_SHOW = 5;

/**
 * Who an artist is, for the purposes of a battle.
 *
 * The same key the charts group on: Apple's own profile id for the primary
 * artist, falling back to the credited name. Never the submitting account,
 * because a manager or label posts several artists from one login.
 */
const KEY = (alias: string) =>
  Prisma.raw(`COALESCE(${alias}."appleArtistId", 'name:' || ${alias}."artistName")`);

/* ------------------------------------------------------------------ */
/* Tickets                                                             */
/* ------------------------------------------------------------------ */

/**
 * A battle's id, sealed.
 *
 * The public id opens the share card, and the share card names both songs.
 * A listener who has not voted must not be holding it, or the blind test is
 * one request away from not being blind. So an open battle is handed over
 * as a ticket only this server can read, and the real id arrives with the
 * reveal.
 */
function ticketKey() {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.FAN_SESSION_SECRET ?? "";
  return crypto.createHash("sha256").update("battle-ticket:" + secret).digest();
}

export function sealBattleId(id: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", ticketKey(), iv);
  const body = Buffer.concat([c.update(id, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

export function openBattleTicket(ticket: string): string | null {
  try {
    const raw = Buffer.from(ticket, "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", ticketKey(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Pairing                                                             */
/* ------------------------------------------------------------------ */

type Candidate = {
  id: string;
  genre: string;
  key: string;
  ai: boolean;
  battles: number;
  artistBattles: number;
};

function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

/**
 * Pair everybody who can be paired this week and is not yet.
 *
 * Runs whenever battles are asked for, so a song submitted on a Wednesday
 * finds an opponent that day if one is waiting, and otherwise goes in on
 * Sunday. An advisory lock makes two requests arriving together pair once.
 *
 * Each artist enters their song with the fewest battles so far, so a
 * catalogue is worked through in turn. Where a group has an odd number,
 * the artist who has battled most sits the week out.
 */
export async function pairThisWeek(now = new Date()): Promise<number> {
  const week = battleWeek(now);

  const unpaired = () => Prisma.sql`
    SELECT t."id", t."genre", ${KEY("t")} AS key,
           COALESCE(t."aiGenerated", false) AS ai,
           t."battles",
           (SELECT COALESCE(SUM(x."battles"), 0)::int FROM "Track" x WHERE ${KEY("x")} = ${KEY("t")}) AS "artistBattles"
    FROM "Track" t
    WHERE t."status" = 'DISCOVERY'::"TrackStatus"
      AND t."artistId" IS NOT NULL
      AND t."genre" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Battle" b
        JOIN "Track" bt ON bt."id" IN (b."trackAId", b."trackBId")
        WHERE b."weekStart" = ${week.start}
          AND b."cancelledAt" IS NULL
          AND ${KEY("bt")} = ${KEY("t")}
      )`;

  const plan = (rows: Candidate[]) => {
    // One song per artist: the one of theirs that has battled least.
    const byArtist = new Map<string, Candidate>();
    for (const r of shuffle([...rows])) {
      const cur = byArtist.get(r.key);
      if (!cur || r.battles < cur.battles) byArtist.set(r.key, r);
    }
    const groups = new Map<string, Candidate[]>();
    for (const c of byArtist.values()) {
      const g = `${c.genre}|${c.ai ? "ai" : "human"}`;
      groups.set(g, [...(groups.get(g) ?? []), c]);
    }
    const pairs: { genre: string; a: string; b: string }[] = [];
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      shuffle(list);
      if (list.length % 2 === 1) {
        // The one who has battled most waits for next week.
        let most = 0;
        for (let i = 1; i < list.length; i++) {
          if (list[i].artistBattles > list[most].artistBattles) most = i;
        }
        list.splice(most, 1);
      }
      for (let i = 0; i + 1 < list.length; i += 2) {
        // Which goes on the left is a coin toss, and the shuffle was it.
        pairs.push({ genre: list[i].genre, a: list[i].id, b: list[i + 1].id });
      }
    }
    return pairs;
  };

  // A look before locking. Most requests find nothing to do and stop here.
  const peek = await prisma.$queryRaw<Candidate[]>(unpaired());
  if (plan(peek).length === 0) return 0;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"motr-battles:" + week.start.toISOString()}))`;
    const rows = await tx.$queryRaw<Candidate[]>(unpaired());
    const pairs = plan(rows);
    if (pairs.length === 0) return 0;
    await tx.battle.createMany({
      data: pairs.map((p) => ({
        weekStart: week.start,
        genre: p.genre,
        trackAId: p.a,
        trackBId: p.b,
      })),
    });
    return pairs.length;
  });
}

/**
 * Call off any open battle with a song that has been pulled.
 *
 * Without this the other artist is stranded: their battle stops being
 * shown, and because they still count as being in one, they are not paired
 * again until Sunday. Calling it off frees them at once, so the pairing
 * that runs next gives them a new opponent if anybody in their genre is
 * waiting.
 *
 * They are not handed the win. A Battle Win nobody voted for would make
 * every other one worth less.
 *
 * Only a pulled song does this. One that has broken through is still on
 * MOTR, and finishes the battle it is in.
 *
 * Runs as part of the housekeeping on every visit rather than from each
 * place a song can be pulled, of which there are several, so no way of
 * pulling one can forget to do it.
 */
export async function cancelBrokenBattles(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE "Battle" b
    SET "cancelledAt" = NOW(), "settledAt" = NOW()
    WHERE b."settledAt" IS NULL
      AND b."cancelledAt" IS NULL
      AND EXISTS (
        SELECT 1 FROM "Track" t
        WHERE t."id" IN (b."trackAId", b."trackBId")
          AND t."status" = 'REJECTED'::"TrackStatus"
      )
    RETURNING b."id"
  `);
  return rows.length;
}

/** Everything that has to be true before battles are read or served. */
export async function battleHousekeeping() {
  await settleFinishedWeeks();
  await cancelBrokenBattles();
  await pairThisWeek();
}

/**
 * Count the weeks that have ended.
 *
 * Nothing runs on a timer for this. The first time battles are asked for
 * after a week closes, its results are written: one statement claims every
 * unsettled battle and names its winner, so two requests arriving together
 * cannot count a week twice, and the all-time counters follow from exactly
 * the rows that statement returned.
 */
export async function settleFinishedWeeks(now = new Date()): Promise<number> {
  const week = battleWeek(now);
  const done = await prisma.$queryRaw<
    Array<{ trackAId: string; trackBId: string; winnerId: string | null; votes: number }>
  >(Prisma.sql`
    UPDATE "Battle"
    SET "settledAt" = NOW(),
        "winnerId" = CASE
          WHEN "votesA" > "votesB" THEN "trackAId"
          WHEN "votesB" > "votesA" THEN "trackBId"
          ELSE NULL
        END
    WHERE "settledAt" IS NULL AND "weekStart" < ${week.start}
    RETURNING "trackAId", "trackBId", "winnerId", ("votesA" + "votesB")::int AS votes
  `);
  if (done.length === 0) return 0;

  // A battle nobody voted in was not fought, and is on nobody's record.
  const fought = new Map<string, number>();
  const won = new Map<string, number>();
  for (const d of done) {
    if (d.votes === 0) continue;
    for (const t of [d.trackAId, d.trackBId]) fought.set(t, (fought.get(t) ?? 0) + 1);
    if (d.winnerId) won.set(d.winnerId, (won.get(d.winnerId) ?? 0) + 1);
  }
  const apply = async (m: Map<string, number>, column: "battles" | "battleWins") => {
    if (m.size === 0) return;
    const values = Prisma.join([...m.entries()].map(([id, n]) => Prisma.sql`(${id}, ${n}::int)`));
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Track" t
      SET ${Prisma.raw(`"${column}"`)} = t.${Prisma.raw(`"${column}"`)} + v.n
      FROM (VALUES ${values}) AS v(id, n)
      WHERE t."id" = v.id
    `);
  };
  await apply(fought, "battles");
  await apply(won, "battleWins");
  return done.length;
}

/* ------------------------------------------------------------------ */
/* Serving and voting                                                  */
/* ------------------------------------------------------------------ */

/**
 * What the screen is given before a vote.
 *
 * The same things the Discover card shows: the clip, the song's title, its
 * cover and the genre. Never the artist's name, and never an id that could
 * be used to look it up. The two screens are blind in the same way, so a
 * listener is not told one thing here and another there.
 */
type OpenSide = { previewUrl: string; title: string; artworkUrl: string | null };
export type OpenBattle = {
  ticket: string;
  genre: string;
  a: OpenSide;
  b: OpenSide;
};

type Side = {
  title: string;
  artistName: string;
  artworkUrl: string | null;
  spotifyUrl: string;
  /** Everything this artist has ever won, across all their songs. */
  wins: number;
};

export type Reveal = {
  /** The public id, for sharing. Only ever sent after a vote. */
  id: string;
  /** The listener's own pick, where they made one. */
  pick: "A" | "B" | null;
  a: Side;
  b: Side;
  /** Null until enough votes are in to mean something. */
  pct: { a: number; b: number } | null;
  /** True once the week is over and the result stands. */
  closed: boolean;
  winner: "A" | "B" | null;
  /** "November 15 - November 21" */
  week: string;
  /** The day voting ends, as "Saturday, November 21". */
  closes: string;
  genre: string;
};

export class BattleGoneError extends Error {
  constructor(message = "That battle is not open") {
    super(message);
    this.name = "BattleGoneError";
  }
}

type BattleRow = {
  id: string;
  genre: string;
  weekStart: Date;
  cancelledAt?: Date | null;
  trackAId: string;
  trackBId: string;
  votesA: number;
  votesB: number;
  settledAt: Date | null;
  winnerId: string | null;
};

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

/** Both songs named, with the split where there are votes enough to show. */
export async function revealBattle(battle: BattleRow, pick: "A" | "B" | null): Promise<Reveal> {
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

  const total = battle.votesA + battle.votesB;
  const a = total ? Math.round((battle.votesA / total) * 100) : 0;
  const closed = battle.weekStart.getTime() < battleWeek().start.getTime();

  return {
    id: battle.id,
    pick,
    a: side(battle.trackAId),
    b: side(battle.trackBId),
    pct: total >= MIN_VOTES_TO_SHOW ? { a, b: 100 - a } : null,
    closed,
    winner: closed
      ? battle.winnerId === battle.trackAId
        ? "A"
        : battle.winnerId === battle.trackBId
          ? "B"
          : null
      : null,
    week: weekOf(battle.weekStart).label,
    closes: `Saturday, ${weekOf(battle.weekStart).label.split(" - ")[1]}`,
    genre: battle.genre,
  };
}

/**
 * The listener's next battle.
 *
 * Returns an open battle, a reveal, or neither when there is nothing left.
 * A reveal comes back only for a battle asked for by its shared link that
 * this listener has already answered, or that has closed: somebody who
 * follows a link to a battle should always land on that battle.
 *
 * Otherwise it is the open battle with the fewest votes that they have not
 * answered, so the votes there are get spread evenly instead of piling
 * onto whichever battle was listed first.
 */
export async function nextBattle(
  fanId: string,
  excludeAi: boolean,
  asked?: string | null
): Promise<{ battle: OpenBattle | null; reveal: Reveal | null; viaShare: boolean }> {
  await battleHousekeeping();
  const week = battleWeek();

  const open = async (b: BattleRow): Promise<OpenBattle | null> => {
    const tracks = await prisma.track.findMany({
      where: { id: { in: [b.trackAId, b.trackBId] }, status: { not: "REJECTED" } },
      select: { id: true, previewUrl: true, title: true, artworkUrl: true },
    });
    const ta = tracks.find((t) => t.id === b.trackAId);
    const tb = tracks.find((t) => t.id === b.trackBId);
    if (!ta || !tb) return null;
    const side = (t: typeof ta): OpenSide => ({
      previewUrl: t.previewUrl,
      title: t.title,
      artworkUrl: t.artworkUrl,
    });
    return { ticket: sealBattleId(b.id), genre: b.genre, a: side(ta), b: side(tb) };
  };

  if (asked) {
    const b = await prisma.battle.findUnique({ where: { id: asked } });
    // A link to a battle that was called off carries on to the next one.
    if (b && !b.cancelledAt) {
      const vote = await prisma.battleVote.findUnique({
        where: { battleId_fanId: { battleId: b.id, fanId } },
      });
      const closed = b.weekStart.getTime() < week.start.getTime();
      if (closed || (vote && vote.pick !== "SKIP")) {
        const pick = vote?.pick === "A" || vote?.pick === "B" ? vote.pick : null;
        return { battle: null, reveal: await revealBattle(b, pick), viaShare: true };
      }
      if (!vote) {
        const ready = await open(b);
        if (ready) return { battle: ready, reveal: null, viaShare: true };
      }
    }
  }

  const rows = await prisma.$queryRaw<Array<BattleRow>>(Prisma.sql`
    SELECT b.*
    FROM "Battle" b
    JOIN "Track" ta ON ta."id" = b."trackAId"
    JOIN "Track" tb ON tb."id" = b."trackBId"
    WHERE b."weekStart" = ${week.start}
      AND b."cancelledAt" IS NULL
      AND ta."status" <> 'REJECTED'::"TrackStatus"
      AND tb."status" <> 'REJECTED'::"TrackStatus"
      ${
        excludeAi
          ? Prisma.sql`AND NOT (COALESCE(ta."aiGenerated", false) OR COALESCE(tb."aiGenerated", false))`
          : Prisma.empty
      }
      AND NOT EXISTS (
        SELECT 1 FROM "BattleVote" v WHERE v."battleId" = b."id" AND v."fanId" = ${fanId}
      )
    ORDER BY (b."votesA" + b."votesB") ASC, RANDOM()
    LIMIT 1
  `);
  if (rows.length === 0) return { battle: null, reveal: null, viaShare: false };
  return { battle: await open(rows[0]), reveal: null, viaShare: false };
}

/**
 * Record the listener's answer.
 *
 * The vote row goes in first, under a unique index on battle and listener,
 * so a second tap or a second tab is refused by the database before any
 * count moves. A skip is kept so the battle is not served again; it counts
 * for nobody and returns no reveal, because the reveal is what a vote earns.
 */
export async function decideBattle(
  fanId: string,
  ticket: string,
  pick: "A" | "B" | "SKIP",
  viaShare = false
): Promise<Reveal | null> {
  const id = openBattleTicket(ticket);
  if (!id) throw new BattleGoneError();

  const battle = await prisma.battle.findUnique({ where: { id } });
  if (!battle || battle.cancelledAt) throw new BattleGoneError();
  if (battle.weekStart.getTime() !== battleWeek().start.getTime()) {
    throw new BattleGoneError("That battle has closed");
  }

  try {
    await prisma.battleVote.create({ data: { battleId: id, fanId, pick, viaShare } });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") throw new BattleGoneError("Already answered");
    throw e;
  }

  if (pick === "SKIP") return null;

  const updated = await prisma.battle.update({
    where: { id },
    data: pick === "A" ? { votesA: { increment: 1 } } : { votesB: { increment: 1 } },
  });
  return revealBattle(updated, pick);
}

/** Everything the share card needs. Public, by the id a reveal hands out. */
export async function battleForCard(id: string): Promise<Reveal | null> {
  const b = await prisma.battle.findUnique({ where: { id } });
  if (!b) return null;
  return revealBattle(b, null);
}

/* ------------------------------------------------------------------ */
/* Boards                                                              */
/* ------------------------------------------------------------------ */

export type BattleLeader = { key: string; name: string; wins: number };

/**
 * Battle Wins for the weeks starting inside a window, by artist.
 *
 * Counted from the Battle rows by who is ahead, so one query answers a
 * closed week, where that is the result, and the week in progress, where
 * it is the standing so far, the same way the other two boards are live
 * until Saturday. With one battle per artist per week most artists have
 * one win, so ties are ordered by how clearly it was won.
 */
export async function battleLeadersBetween(
  start: Date,
  end: Date,
  limit = 10
): Promise<BattleLeader[]> {
  const rows = await prisma.$queryRaw<Array<{ key: string; name: string; wins: number }>>(Prisma.sql`
    WITH led AS (
      SELECT CASE WHEN b."votesA" > b."votesB" THEN b."trackAId" ELSE b."trackBId" END AS track,
             GREATEST(b."votesA", b."votesB")::float / (b."votesA" + b."votesB") AS share
      FROM "Battle" b
      WHERE b."weekStart" >= ${start}
        AND b."weekStart" < ${end}
        AND b."cancelledAt" IS NULL
        AND b."votesA" <> b."votesB"
    )
    SELECT ${KEY("t")} AS key,
           MAX(COALESCE(t."appleArtistName", t."artistName")) AS name,
           COUNT(*)::int AS wins
    FROM led
    JOIN "Track" t ON t."id" = led.track
    WHERE t."status" <> 'REJECTED'::"TrackStatus"
    GROUP BY 1
    ORDER BY wins DESC, AVG(led.share) DESC, name ASC
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

/* ------------------------------------------------------------------ */
/* Saved                                                               */
/* ------------------------------------------------------------------ */

/**
 * The songs a listener has picked in battles, for their Saved list.
 *
 * Read from the votes rather than written as swipes. A right swipe is what
 * the charts count, so recording a battle pick as one would let battles
 * move chart positions and the weekly winner, which is the one thing they
 * are promised not to do. Kept apart, a pick can sit in somebody's library
 * without being anybody's chart save.
 */
export async function battlePicksFor(fanId: string): Promise<{ trackId: string; at: Date }[]> {
  const votes = await prisma.battleVote.findMany({
    where: { fanId, pick: { in: ["A", "B"] }, hiddenAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { battleId: true, pick: true, createdAt: true },
  });
  if (votes.length === 0) return [];
  const battles = await prisma.battle.findMany({
    where: { id: { in: votes.map((v) => v.battleId) } },
    select: { id: true, trackAId: true, trackBId: true },
  });
  const byId = new Map(battles.map((b) => [b.id, b]));
  const out: { trackId: string; at: Date }[] = [];
  for (const v of votes) {
    const b = byId.get(v.battleId);
    if (b) out.push({ trackId: v.pick === "A" ? b.trackAId : b.trackBId, at: v.createdAt });
  }
  return out;
}

/**
 * Take a battle pick, or all of them, off the listener's Saved list.
 *
 * The vote stands. This only stops the song being listed.
 */
export async function hideBattlePicks(fanId: string, trackId?: string): Promise<number> {
  const votes = await prisma.battleVote.findMany({
    where: { fanId, pick: { in: ["A", "B"] }, hiddenAt: null },
    select: { id: true, battleId: true, pick: true },
  });
  if (votes.length === 0) return 0;
  let ids = votes.map((v) => v.id);
  if (trackId) {
    const battles = await prisma.battle.findMany({
      where: { id: { in: votes.map((v) => v.battleId) } },
      select: { id: true, trackAId: true, trackBId: true },
    });
    const byId = new Map(battles.map((b) => [b.id, b]));
    ids = votes
      .filter((v) => {
        const b = byId.get(v.battleId);
        return b && (v.pick === "A" ? b.trackAId : b.trackBId) === trackId;
      })
      .map((v) => v.id);
  }
  if (ids.length === 0) return 0;
  const { count } = await prisma.battleVote.updateMany({
    where: { id: { in: ids } },
    data: { hiddenAt: new Date() },
  });
  return count;
}
