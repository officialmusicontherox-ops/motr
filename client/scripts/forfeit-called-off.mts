/**
 * Turns this week's called-off battles (a song was pulled) into wins for the
 * song left standing, the way they are decided from now on.
 *
 *   dry run: DATABASE_URL="$NEON" npx tsx scripts/forfeit-called-off.mts
 *   apply:   DATABASE_URL="$NEON" npx tsx scripts/forfeit-called-off.mts --apply
 *
 * The winner's result email then goes out on the next Battles visit, like
 * any other decided battle. The pulled artist is not written to.
 */
const { prisma } = await import("../lib/prisma.ts");
const { battleWeek, recordResults } = await import("../lib/battles.ts");
const apply = process.argv.includes("--apply");
const week = battleWeek();

const called = await prisma.battle.findMany({
  where: { weekStart: week.start, cancelledAt: { not: null } },
});
for (const b of called) {
  const [ta, tb] = await Promise.all([
    prisma.track.findUnique({ where: { id: b.trackAId }, select: { status: true, artistName: true, title: true } }),
    prisma.track.findUnique({ where: { id: b.trackBId }, select: { status: true, artistName: true, title: true } }),
  ]);
  const aOut = ta?.status === "REJECTED";
  const bOut = tb?.status === "REJECTED";
  if (aOut === bOut) {
    console.log(`  skip   ${b.id}  (not a single pulled song: ${ta?.artistName} / ${tb?.artistName})`);
    continue;
  }
  const winner = aOut ? b.trackBId : b.trackAId;
  const w = aOut ? tb : ta;
  console.log(`  WIN    ${w?.artistName}, "${w?.title}"  (battle ${b.id}, votes ${b.votesA}-${b.votesB})`);
  if (!apply) continue;
  await prisma.battle.update({
    where: { id: b.id },
    data: {
      cancelledAt: null,
      forfeitAt: new Date(),
      settledAt: new Date(),
      winnerId: winner,
      resultSentAAt: null,
      resultSentBAt: null,
    },
  });
  await recordResults([{ trackAId: b.trackAId, trackBId: b.trackBId, winnerId: winner, votes: 1 }]);
}
console.log(apply ? "  applied" : "  dry run. pass --apply to make the change");
process.exit(0);
