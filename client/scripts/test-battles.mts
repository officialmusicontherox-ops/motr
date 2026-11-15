/**
 * Proves the battle rules against the local database.
 *
 *   npx tsx scripts/test-battles.mts
 *
 * Builds its own genre so nothing already in the database can be paired
 * with the test songs, plays every battle a fresh listener can get, and
 * checks the rules that make a win mean something.
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");

// This parks every live track while it runs. Never against production.
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
  console.error("  refusing to run: DATABASE_URL is not a local database");
  process.exit(1);
}

const { nextBattle, decideBattle, battleLeadersBetween, BattleGoneError } = await import(
  "../lib/battles.ts"
);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const id = () => crypto.randomBytes(4).toString("hex");
const pass = (m: string) => console.log("  PASS  " + m);
const fail = (m: string) => {
  console.log("  FAIL  " + m);
  process.exitCode = 1;
};

const GENRE = "Test Genre " + id();
const LONELY = "Lonely Genre " + id();

async function artist(name: string) {
  return prisma.artist.create({ data: { name, email: `${id()}@example.invalid` } });
}
async function track(artistId: string, artistName: string, genre: string, apple?: string) {
  return prisma.track.create({
    data: {
      source: "SPOTIFY",
      externalId: "test" + id() + id(),
      title: "Song " + id(),
      artistName,
      previewUrl: "https://example.invalid/" + id() + ".m4a",
      artistId,
      genre,
      appleArtistId: apple ?? null,
    },
  });
}

const made: { artists: string[]; tracks: string[]; fans: string[] } = {
  artists: [],
  tracks: [],
  fans: [],
};

async function main() {
  // Hide whatever is already in the local database from the picker, so the
  // only eligible songs are the ones built here.
  const parked = await prisma.track.findMany({
    where: { status: "DISCOVERY" },
    select: { id: true },
  });
  await prisma.track.updateMany({
    where: { id: { in: parked.map((p) => p.id) } },
    data: { status: "VETTING" },
  });

  try {
    // One artist with three songs under one Apple profile but two spellings,
    // which is the case a name comparison alone would get wrong.
    const x = await artist("Artist X " + id());
    const y = await artist("Artist Y " + id());
    const z = await artist("Artist Z " + id());
    const solo = await artist("Solo " + id());
    made.artists.push(x.id, y.id, z.id, solo.id);

    const apple = "apple" + id();
    const x1 = await track(x.id, x.name, GENRE, apple);
    const x2 = await track(x.id, x.name, GENRE, apple);
    const x3 = await track(x.id, x.name + " feat. Someone", GENRE, apple);
    const y1 = await track(y.id, y.name, GENRE);
    const z1 = await track(z.id, z.name, GENRE);
    const s1 = await track(solo.id, solo.name, LONELY);
    made.tracks.push(x1.id, x2.id, x3.id, y1.id, z1.id, s1.id);
    const xs = new Set([x1.id, x2.id, x3.id]);

    const fan = await prisma.fan.create({ data: { username: "battle-" + id() } });
    const other = await prisma.fan.create({ data: { username: "battle-" + id() } });
    made.fans.push(fan.id, other.id);

    // 1. The same open battle comes back until it is answered.
    const b1 = await nextBattle(fan.id, false);
    const again = await nextBattle(fan.id, false);
    b1 && again && b1.id === again.id
      ? pass("an unanswered battle is handed back, not replaced")
      : fail("a second battle was made while the first sat open");

    // 2. Nothing in the payload names anybody.
    const leaked = JSON.stringify(b1).match(/title|artist|artwork|trackAId|trackBId/i);
    !leaked ? pass("the open battle carries no names, titles or track ids") : fail(`leaked ${leaked}`);

    // 3. Somebody else cannot answer it.
    try {
      await decideBattle(other.id, b1!.id, "A");
      fail("another listener answered this battle");
    } catch (e) {
      e instanceof BattleGoneError ? pass("only the listener it was served to can answer") : fail(String(e));
    }

    // 4. Play every battle this listener can get.
    const seen = new Map<string, number>();
    let sameArtist = 0;
    let crossGenre = 0;
    let rounds = 0;
    let firstReveal: Awaited<ReturnType<typeof decideBattle>> = null;

    for (let guard = 0; guard < 20; guard++) {
      const b = await nextBattle(fan.id, false);
      if (!b) break;
      rounds++;
      const row = await prisma.battle.findUnique({ where: { id: b.id } });
      for (const t of [row!.trackAId, row!.trackBId]) seen.set(t, (seen.get(t) ?? 0) + 1);
      if (xs.has(row!.trackAId) && xs.has(row!.trackBId)) sameArtist++;
      const pair = await prisma.track.findMany({
        where: { id: { in: [row!.trackAId, row!.trackBId] } },
        select: { genre: true },
      });
      if (pair[0].genre !== pair[1].genre) crossGenre++;
      const r = await decideBattle(fan.id, b.id, "A");
      firstReveal ??= r;
    }

    rounds >= 1 ? pass(`${rounds} battle(s) served from five songs by three artists`) : fail("no battles served");
    sameArtist === 0
      ? pass("an artist never faced their own song, even credited under another spelling")
      : fail(`${sameArtist} battle(s) between one artist's own songs`);
    crossGenre === 0 ? pass("every battle stayed inside one genre") : fail(`${crossGenre} crossed genres`);
    [...seen.values()].every((n) => n === 1)
      ? pass("no song was played to the same listener twice")
      : fail("a song came back");
    !seen.has(s1.id)
      ? pass("a song with nobody to face is passed over, not paired across genres")
      : fail("the lone song was paired");

    // 5. The reveal names both and carries the artist's total.
    firstReveal && firstReveal.a.title && firstReveal.b.artistName && firstReveal.winner === "A"
      ? pass("a vote returns the reveal with both songs named")
      : fail("no reveal");
    firstReveal && firstReveal.a.wins >= 1
      ? pass(`the winner's all-time total is on the reveal (${firstReveal.a.wins})`)
      : fail("winner shows no wins");

    // 6. Counters add up: every decided battle gave one win and two plays.
    const t = await prisma.track.findMany({
      where: { id: { in: made.tracks } },
      select: { battles: true, battleWins: true },
    });
    const plays = t.reduce((a, r) => a + r.battles, 0);
    const wins = t.reduce((a, r) => a + r.battleWins, 0);
    plays === rounds * 2 && wins === rounds
      ? pass(`counters add up: ${rounds} battles, ${wins} wins, ${plays} appearances`)
      : fail(`${rounds} battles but ${wins} wins and ${plays} appearances`);

    // 7. A second answer to the same battle is refused and counts nothing.
    const done = await prisma.battle.findFirst({ where: { fanId: fan.id }, select: { id: true } });
    try {
      await decideBattle(fan.id, done!.id, "B");
      fail("a decided battle was answered again");
    } catch (e) {
      e instanceof BattleGoneError ? pass("a battle cannot be answered twice") : fail(String(e));
    }
    const after = await prisma.track.aggregate({
      where: { id: { in: made.tracks } },
      _sum: { battleWins: true },
    });
    after._sum.battleWins === wins ? pass("the refused answer changed no totals") : fail("totals moved");

    // 8. A skip counts for nobody and reveals nothing.
    const b2 = await nextBattle(other.id, false);
    const skipped = await decideBattle(other.id, b2!.id, "SKIP");
    const afterSkip = await prisma.track.aggregate({
      where: { id: { in: made.tracks } },
      _sum: { battleWins: true, battles: true },
    });
    skipped === null && afterSkip._sum.battleWins === wins && afterSkip._sum.battles === plays
      ? pass("a skip returns no reveal and moves no totals")
      : fail("a skip counted for something");

    // 9. Fewest battles first: the next listener's first song is never one
    //    that has already battled while another has not.
    const least = await prisma.track.findMany({
      where: { id: { in: [x1.id, x2.id, x3.id, y1.id, z1.id] } },
      select: { id: true, battles: true },
    });
    const min = Math.min(...least.map((l) => l.battles));
    const third = await prisma.fan.create({ data: { username: "battle-" + id() } });
    made.fans.push(third.id);
    const b3 = await nextBattle(third.id, false);
    const row3 = await prisma.battle.findUnique({ where: { id: b3!.id } });
    const inIt = least.filter((l) => l.id === row3!.trackAId || l.id === row3!.trackBId);
    inIt.some((l) => l.battles === min)
      ? pass("the song with the fewest battles is brought in first")
      : fail("a well-travelled song was picked ahead of a fresh one");

    // 10. The weekly board counts the wins that were just recorded.
    const board = await battleLeadersBetween(new Date(Date.now() - 3600_000), new Date(Date.now() + 3600_000), 50);
    const mine = board.filter((r) => [x.name, y.name, z.name].some((n) => r.name.startsWith(n.split(" feat.")[0])));
    mine.reduce((a, r) => a + r.wins, 0) === wins
      ? pass("the board for this window adds up to the wins recorded")
      : fail(`board shows ${mine.reduce((a, r) => a + r.wins, 0)}, expected ${wins}`);
    mine.filter((r) => r.name.startsWith(x.name)).length <= 1
      ? pass("one artist is one row on the board, whatever the credit says")
      : fail("the same artist appears twice on the board");
  } finally {
    await prisma.battle.deleteMany({ where: { fanId: { in: made.fans } } });
    await prisma.track.deleteMany({ where: { id: { in: made.tracks } } });
    await prisma.artist.deleteMany({ where: { id: { in: made.artists } } });
    await prisma.fan.deleteMany({ where: { id: { in: made.fans } } });
    await prisma.track.updateMany({
      where: { id: { in: parked.map((p) => p.id) } },
      data: { status: "DISCOVERY" },
    });
    console.log("\n  cleaned up");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
