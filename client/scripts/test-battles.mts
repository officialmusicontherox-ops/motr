/**
 * Proves the battle rules against the LOCAL database.
 *
 *   npx tsx scripts/test-battles.mts
 *
 * Builds its own genres and artists, pairs a week, votes as several
 * listeners, then moves the week into the past and settles it.
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

const B = await import("../lib/battles.ts");
const { weekOf } = await import("../lib/weekWindow.ts");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const id = () => crypto.randomBytes(4).toString("hex");
const pass = (m: string) => console.log("  PASS  " + m);
const fail = (m: string) => {
  console.log("  FAIL  " + m);
  process.exitCode = 1;
};
const check = (ok: boolean, good: string, bad = good) => (ok ? pass(good) : fail(bad));

const GENRE = "Test Genre " + id();
const LONELY = "Lonely Genre " + id();
const made = { artists: [] as string[], tracks: [] as string[], fans: [] as string[] };

async function artist(name: string) {
  const a = await prisma.artist.create({ data: { name, email: `${id()}@example.invalid` } });
  made.artists.push(a.id);
  return a;
}
async function track(a: { id: string; name: string }, genre: string, opts: { apple?: string; ai?: boolean; credit?: string } = {}) {
  const t = await prisma.track.create({
    data: {
      source: "SPOTIFY",
      externalId: "test" + id() + id(),
      title: "Song " + id(),
      artistName: opts.credit ?? a.name,
      previewUrl: "https://example.invalid/" + id() + ".m4a",
      artistId: a.id,
      genre,
      appleArtistId: opts.apple ?? null,
      aiGenerated: opts.ai ?? false,
    },
  });
  made.tracks.push(t.id);
  return t;
}
async function fan() {
  const f = await prisma.fan.create({ data: { username: "battle-" + id() } });
  made.fans.push(f.id);
  return f;
}

async function main() {
  const parked = await prisma.track.findMany({ where: { status: "DISCOVERY" }, select: { id: true } });
  await prisma.track.updateMany({ where: { id: { in: parked.map((p) => p.id) } }, data: { status: "VETTING" } });
  const week = B.battleWeek();

  try {
    // Four human artists and two AI ones in one genre, one artist alone in
    // another. X has three songs under one Apple profile and two spellings.
    const x = await artist("Artist X " + id());
    const y = await artist("Artist Y " + id());
    const z = await artist("Artist Z " + id());
    const w = await artist("Artist W " + id());
    const ai1 = await artist("Synthetic One " + id());
    const ai2 = await artist("Synthetic Two " + id());
    const solo = await artist("Solo " + id());
    const apple = "apple" + id();
    const xs = [
      await track(x, GENRE, { apple }),
      await track(x, GENRE, { apple }),
      await track(x, GENRE, { apple, credit: x.name + " feat. Someone" }),
    ];
    await track(y, GENRE);
    await track(z, GENRE);
    await track(w, GENRE);
    const a1 = await track(ai1, GENRE, { ai: true });
    const a2 = await track(ai2, GENRE, { ai: true });
    const s1 = await track(solo, LONELY);

    // --- pairing ---------------------------------------------------------
    const n = await B.pairThisWeek();
    const mine = () =>
      prisma.battle.findMany({
        where: { weekStart: week.start, OR: [{ trackAId: { in: made.tracks } }, { trackBId: { in: made.tracks } }] },
      });
    let battles = await mine();
    check(n === 3 && battles.length === 3, "seven artists made three battles: two human, one AI", `paired ${n}, found ${battles.length}`);

    const again = await B.pairThisWeek();
    check(again === 0 && (await mine()).length === 3, "pairing again changes nothing");

    const inBattle = battles.flatMap((b) => [b.trackAId, b.trackBId]);
    check(new Set(inBattle).size === inBattle.length, "no song is in two battles");
    check(xs.filter((t) => inBattle.includes(t.id)).length === 1, "an artist with three songs is in exactly one battle");
    check(!inBattle.includes(s1.id), "an artist with nobody to face sits the week out");

    const aiBattle = battles.find((b) => [b.trackAId, b.trackBId].includes(a1.id));
    check(!!aiBattle && [aiBattle.trackAId, aiBattle.trackBId].includes(a2.id), "AI vocals were paired with AI vocals");
    const tracks = await prisma.track.findMany({ where: { id: { in: inBattle } }, select: { id: true, genre: true } });
    check(tracks.every((t) => t.genre === GENRE), "every battle stayed inside one genre");

    // A song that arrives mid-week is paired if somebody is waiting.
    const late = await artist("Late " + id());
    await track(late, LONELY);
    const more = await B.pairThisWeek();
    battles = await mine();
    check(more === 1 && battles.length === 4, "a mid-week arrival is paired with the artist who was waiting");
    check(battles.every((b) => b.weekStart.getTime() === week.start.getTime()), "and its battle belongs to this same week");

    // --- telling artists ---------------------------------------------------
    const N = await import("../lib/battleNotice.ts");
    const pend = (await N.pendingBattleNotices()).filter((x) => made.artists.includes(x.artistId));
    check(pend.length === 8 && pend.every((x) => x.songs.length === 1), "each artist in a battle is to be told once, about their one song", `pending ${pend.length}`);
    await prisma.battle.updateMany({ where: { id: { in: battles.map((b) => b.id) } }, data: { notifiedAAt: new Date() } });
    const half = (await N.pendingBattleNotices()).filter((x) => made.artists.includes(x.artistId));
    check(half.length === 4 && half.every((x) => x.songs[0].side === "B"), "an artist already told is not on the list again");

    // --- serving ---------------------------------------------------------
    const f1 = await fan();
    const f2 = await fan();
    const first = await B.nextBattle(f1.id, false);
    const leaked = JSON.stringify(first.battle).match(/artist|"id"|trackAId|spotify/i);
    check(!!first.battle && !leaked && !!first.battle.a.title, "an open battle shows the title and cover, and no artist name or id", `leaked ${leaked}`);
    const firstId = B.openBattleTicket(first.battle!.ticket);
    check(!!firstId && B.openBattleTicket("x" + first.battle!.ticket) === null, "the ticket opens on the server and a tampered one does not");

    // Everyone gets the same battles: f2 can be served every battle f1 can.
    const seen1 = new Set<string>();
    const seen2 = new Set<string>();
    for (const [f, seen] of [[f1, seen1], [f2, seen2]] as const) {
      for (let g = 0; g < 10; g++) {
        const r = await B.nextBattle(f.id, false);
        if (!r.battle) break;
        seen.add(B.openBattleTicket(r.battle.ticket)!);
        await B.decideBattle(f.id, r.battle.ticket, "SKIP");
      }
    }
    const myIds = new Set(battles.map((b) => b.id));
    const same = [...myIds].every((i) => seen1.has(i) && seen2.has(i));
    check(same, "two listeners were served the same battles");
    const afterSkips = await prisma.battle.aggregate({ where: { id: { in: [...myIds] } }, _sum: { votesA: true, votesB: true } });
    check((afterSkips._sum.votesA ?? 0) + (afterSkips._sum.votesB ?? 0) === 0, "skips counted for nobody");
    const none = await B.nextBattle(f1.id, false);
    check(none.battle === null || !myIds.has(B.openBattleTicket(none.battle.ticket)!), "a skipped battle is not served again");

    // AI switch: a listener hiding AI vocals is never served the AI battle.
    const f3 = await fan();
    const seen3 = new Set<string>();
    for (let g = 0; g < 10; g++) {
      const r = await B.nextBattle(f3.id, true);
      if (!r.battle) break;
      const bid = B.openBattleTicket(r.battle.ticket)!;
      seen3.add(bid);
      await B.decideBattle(f3.id, r.battle.ticket, "SKIP");
    }
    check(!seen3.has(aiBattle!.id) && seen3.size >= 3, "with AI vocals hidden the AI battle is left out and the rest are served");

    // --- voting and percentages -----------------------------------------
    const target = battles.find((b) => b.id !== aiBattle!.id)!;
    const voters = [];
    for (let i = 0; i < 5; i++) voters.push(await fan());

    // By shared link: served first, whatever else is open.
    const viaLink = await B.nextBattle(voters[0].id, false, target.id);
    check(!!viaLink.battle && B.openBattleTicket(viaLink.battle.ticket) === target.id && viaLink.viaShare, "a shared link serves that battle first");

    let reveal = await B.decideBattle(voters[0].id, viaLink.battle!.ticket, "A", true);
    check(!!reveal && reveal.pick === "A" && !!reveal.a.title && !!reveal.b.artistName && reveal.id === target.id, "a vote returns both songs named and the shareable id");
    check(reveal!.pct === null, "with one vote in, no percentage is shown");

    try {
      await B.decideBattle(voters[0].id, viaLink.battle!.ticket, "B");
      fail("the same listener voted twice");
    } catch (e) {
      check(e instanceof B.BattleGoneError, "one vote per listener per battle");
    }

    for (let i = 1; i < 5; i++) {
      const r = await B.nextBattle(voters[i].id, false, target.id);
      reveal = await B.decideBattle(voters[i].id, r.battle!.ticket, i < 4 ? "A" : "B");
    }
    check(!!reveal!.pct && reveal!.pct.a === 80 && reveal!.pct.b === 20, "at five votes the split appears: 80% to 20%", `pct was ${JSON.stringify(reveal!.pct)}`);
    check(!("votes" in (reveal as object)) && !JSON.stringify(reveal).match(/votesA|votesB/), "the reveal carries percentages and never the counts");

    // --- saved -------------------------------------------------------------
    const picks = await B.battlePicksFor(voters[0].id);
    check(picks.length === 1 && picks[0].trackId === target.trackAId, "the song a listener picked is listed for their Saved");
    const swipes = await prisma.fanSwipe.count({ where: { fanId: voters[0].id } });
    const counted = await prisma.track.findUnique({ where: { id: target.trackAId }, select: { fanRightSwipes: true } });
    check(swipes === 0 && counted!.fanRightSwipes === 0, "and it is not a swipe, so no chart counts it as a save");
    check((await B.battlePicksFor(f1.id)).length === 0, "a skip puts nothing in Saved");
    check((await B.hideBattlePicks(voters[0].id, target.trackAId)) === 1 && (await B.battlePicksFor(voters[0].id)).length === 0, "taking it off Saved removes it from the list");
    const stillCounted = await prisma.battle.findUnique({ where: { id: target.id }, select: { votesA: true } });
    check(stillCounted!.votesA === 4, "and the vote itself still stands");

    const back = await B.nextBattle(voters[0].id, false, target.id);
    check(back.battle === null && back.reveal?.pick === "A" && back.reveal.pct?.a === 80, "returning by the link shows the standing instead of a second vote");

    // The live board shows who is ahead.
    const liveBoard = await B.battleLeadersBetween(week.start, week.end, 50);
    const leader = await prisma.track.findUnique({ where: { id: target.trackAId }, select: { artistName: true } });
    check(liveBoard.some((r) => leader!.artistName.startsWith(r.name) || r.name.startsWith(leader!.artistName.split(" feat.")[0])), "the artist ahead is on this week's board");

    // --- the week closes --------------------------------------------------
    // A tie in another battle, then move both into last week and settle.
    const tied = battles.find((b) => b.id !== target.id && b.id !== aiBattle!.id)!;
    await prisma.battle.update({ where: { id: tied.id }, data: { votesA: 2, votesB: 2 } });
    const lastWeek = weekOf(new Date(week.start.getTime() - 1)).start;
    await prisma.battle.updateMany({ where: { id: { in: [...myIds] } }, data: { weekStart: lastWeek } });

    const settled = await B.settleFinishedWeeks();
    check(settled >= 4, "closing the week settles its battles");
    const t = await prisma.track.findMany({
      where: { id: { in: [target.trackAId, target.trackBId, tied.trackAId, tied.trackBId, aiBattle!.trackAId] } },
      select: { id: true, battles: true, battleWins: true },
    });
    const get = (tid: string) => t.find((r) => r.id === tid)!;
    check(get(target.trackAId).battleWins === 1 && get(target.trackAId).battles === 1, "the winner takes one Battle Win");
    check(get(target.trackBId).battleWins === 0 && get(target.trackBId).battles === 1, "the loser has the battle on record and no win");
    check(get(tied.trackAId).battleWins === 0 && get(tied.trackBId).battleWins === 0 && get(tied.trackAId).battles === 1, "a tie gives nobody a win");
    check(get(aiBattle!.trackAId).battles === 0, "a battle nobody voted in is on nobody's record");
    check((await B.settleFinishedWeeks()) === 0, "settling again counts nothing twice");

    try {
      const stale = B.sealBattleId(target.id);
      await B.decideBattle((await fan()).id, stale, "B");
      fail("a vote landed in a closed battle");
    } catch (e) {
      check(e instanceof B.BattleGoneError, "a closed battle takes no more votes");
    }
    const closed = await B.nextBattle(voters[1].id, false, target.id);
    check(closed.reveal?.closed === true && closed.reveal.winner === "A", "the link to a closed battle shows the final result");

    // --- next week --------------------------------------------------------
    // Following the link above already opened the new week, which is the
    // point: nothing runs on a timer, the first visit does it.
    await B.pairThisWeek();
    const fresh = await prisma.battle.findMany({
      where: { weekStart: week.start, OR: [{ trackAId: { in: made.tracks } }, { trackBId: { in: made.tracks } }] },
    });
    const freshSongs = fresh.flatMap((b) => [b.trackAId, b.trackBId]);
    check(fresh.length >= 3 && new Set(freshSongs).size === freshSongs.length, "a new week pairs everybody again, once each", `found ${fresh.length}`);
    const card = await B.battleForCard(target.id);
    check(!!card && card.closed && card.pct?.a === 80, "the share card for a finished battle has its result");

    // --- a song is pulled mid-week ------------------------------------------
    const G3 = "Pulled Genre " + id();
    const pa = await artist("Pull A " + id());
    const pb = await artist("Pull B " + id());
    const pc = await artist("Pull C " + id());
    const ta = await track(pa, G3);
    const tb = await track(pb, G3);
    const tc = await track(pc, G3);
    await B.pairThisWeek();
    const g3 = [ta.id, tb.id, tc.id];
    const before = await prisma.battle.findMany({
      where: { weekStart: week.start, OR: [{ trackAId: { in: g3 } }, { trackBId: { in: g3 } }] },
    });
    check(before.length === 1, "three artists make one battle and leave one waiting");
    const doomed = before[0];
    const waiting = g3.find((t) => t !== doomed.trackAId && t !== doomed.trackBId)!;
    const survivor = doomed.trackBId;

    // Two votes for the song about to be pulled, then pull it.
    const pv1 = await fan();
    const pv2 = await fan();
    for (const f of [pv1, pv2]) {
      const r = await B.nextBattle(f.id, false, doomed.id);
      await B.decideBattle(f.id, r.battle!.ticket, "A");
    }
    await prisma.track.update({ where: { id: doomed.trackAId }, data: { status: "REJECTED" } });
    await B.battleHousekeeping();

    const off = await prisma.battle.findUnique({ where: { id: doomed.id } });
    check(!!off?.cancelledAt && off.winnerId === null, "pulling a song calls its battle off, with no winner");
    const rematch = await prisma.battle.findFirst({
      where: { weekStart: week.start, cancelledAt: null, OR: [{ trackAId: survivor }, { trackBId: survivor }] },
    });
    check(
      !!rematch && [rematch.trackAId, rematch.trackBId].includes(waiting),
      "the other artist is paired again at once, with the artist who was waiting"
    );
    try {
      await B.decideBattle((await fan()).id, B.sealBattleId(doomed.id), "B");
      fail("a vote landed in a battle that was called off");
    } catch (e) {
      check(e instanceof B.BattleGoneError, "a called-off battle takes no votes");
    }
    const viaOld = await B.nextBattle((await fan()).id, false, doomed.id);
    check(
      !viaOld.battle || B.openBattleTicket(viaOld.battle.ticket) !== doomed.id,
      "its link carries on to another battle"
    );
    const pulledWins = await prisma.track.findUnique({ where: { id: doomed.trackAId }, select: { battleWins: true, battles: true } });
    check(pulledWins!.battleWins === 0 && pulledWins!.battles === 0, "and the pulled song takes nothing from it, though it was ahead");
    check((await B.battlePicksFor(pv1.id)).length === 1, "the listeners who voted keep their pick in Saved");

    // A song that breaks through is still on MOTR and finishes its battle.
    await prisma.track.update({ where: { id: survivor }, data: { status: "VETTING" } });
    await B.battleHousekeeping();
    const kept = await prisma.battle.findUnique({ where: { id: rematch!.id } });
    const served = await B.nextBattle((await fan()).id, false, rematch!.id);
    check(!kept?.cancelledAt && !!served.battle, "a song that breaks through mid-week keeps its battle");
  } finally {
    const mineB = await prisma.battle.findMany({
      where: { OR: [{ trackAId: { in: made.tracks } }, { trackBId: { in: made.tracks } }] },
      select: { id: true },
    });
    await prisma.battleVote.deleteMany({ where: { OR: [{ fanId: { in: made.fans } }, { battleId: { in: mineB.map((b) => b.id) } }] } });
    await prisma.battle.deleteMany({ where: { id: { in: mineB.map((b) => b.id) } } });
    await prisma.track.deleteMany({ where: { id: { in: made.tracks } } });
    await prisma.artist.deleteMany({ where: { id: { in: made.artists } } });
    await prisma.fan.deleteMany({ where: { id: { in: made.fans } } });
    await prisma.track.updateMany({ where: { id: { in: parked.map((p) => p.id) } }, data: { status: "DISCOVERY" } });
    console.log("\n  cleaned up");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
