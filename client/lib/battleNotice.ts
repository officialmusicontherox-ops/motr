import { prisma } from "./prisma";
import { battleOpenEmail, sendEmail } from "./email";
import { isEmailAddress } from "./emailAddress";
import { artistUnsubscribeUrl } from "./nudges";
import { battleHousekeeping, battleWeek } from "./battles";

/**
 * Telling artists their song is in a battle this week.
 *
 * Sent from a button, in batches, because a serverless function here has
 * about ten seconds and a mailing does not fit in one. The browser calls
 * this until it reports done.
 *
 * There is no separate record of the mailing. Each battle carries a marker
 * per side for when that side's artist was told, and the send works from
 * whichever markers are still empty. That makes three things true without
 * any extra bookkeeping: nobody is written to twice, a battle paired later
 * in the week is picked up by pressing the button again, and a send that
 * was interrupted carries on from where it stopped.
 *
 * One email per account, listing every song of theirs in a battle, so a
 * manager who submits for several artists hears once.
 */

const BATCH_MAX = 8;
const BATCH_BUDGET_MS = 4500;
const PACE_MS = 550;

type Pending = {
  artistId: string;
  email: string | null;
  optedOut: boolean;
  songs: { battleId: string; side: "A" | "B"; title: string; artistName: string }[];
};

/** Every account still to be told, with the songs to tell them about. */
export async function pendingBattleNotices(): Promise<Pending[]> {
  const week = battleWeek();
  const battles = await prisma.battle.findMany({
    where: {
      weekStart: week.start,
      cancelledAt: null,
      settledAt: null,
      OR: [{ notifiedAAt: null }, { notifiedBAt: null }],
    },
    orderBy: { createdAt: "asc" },
  });
  const sides = battles.flatMap((b) => [
    ...(b.notifiedAAt ? [] : [{ battleId: b.id, side: "A" as const, trackId: b.trackAId }]),
    ...(b.notifiedBAt ? [] : [{ battleId: b.id, side: "B" as const, trackId: b.trackBId }]),
  ]);
  if (sides.length === 0) return [];

  const tracks = await prisma.track.findMany({
    where: { id: { in: sides.map((s) => s.trackId) } },
    select: {
      id: true,
      title: true,
      artistName: true,
      artist: { select: { id: true, email: true, emailOptOut: true } },
    },
  });
  const byId = new Map(tracks.map((t) => [t.id, t]));

  const out = new Map<string, Pending>();
  for (const s of sides) {
    const t = byId.get(s.trackId);
    if (!t?.artist) continue;
    const cur =
      out.get(t.artist.id) ??
      ({ artistId: t.artist.id, email: t.artist.email, optedOut: t.artist.emailOptOut, songs: [] } as Pending);
    cur.songs.push({ battleId: s.battleId, side: s.side, title: t.title, artistName: t.artistName });
    out.set(t.artist.id, cur);
  }
  return [...out.values()];
}

/**
 * Take the songs to be announced, so no other run sends them. Returns the
 * ones this run won; a song another run already took is left out.
 */
async function claim(songs: Pending["songs"]): Promise<Pending["songs"]> {
  const won: Pending["songs"] = [];
  const now = new Date();
  for (const s of songs) {
    const field = s.side === "A" ? "notifiedAAt" : "notifiedBAt";
    const r = await prisma.battle.updateMany({
      where: { id: s.battleId, [field]: null },
      data: { [field]: now },
    });
    if (r.count === 1) won.push(s);
  }
  return won;
}

export type BattleNoticeProgress = {
  remaining: number;
  sent: number;
  failed: number;
  skipped: number;
  done: boolean;
};

/** What the button would do, without doing it. */
export async function previewBattleNotice() {
  await battleHousekeeping();
  const week = battleWeek();
  const pending = await pendingBattleNotices();
  const battles = await prisma.battle.count({ where: { weekStart: week.start, cancelledAt: null } });
  const reachable = pending.filter((p) => !p.optedOut && isEmailAddress(p.email)).length;
  return { weekLabel: week.label, battles, toSend: reachable, unreachable: pending.length - reachable };
}

/** Send one batch, and say how much is left. Called until done. */
/**
 * Email each artist the link to their battle.
 *
 * Runs on its own after Battles requests (see app/api/battles/next), so a
 * battle is announced as soon as it is paired: the Sunday the week opens,
 * or mid-week when a new artist is paired. The admin button calls the same
 * thing and is only needed to hurry it along.
 */
export async function sendBattleNotice(
  appUrl: string,
  opts: { budgetMs?: number; housekeeping?: boolean } = {}
): Promise<BattleNoticeProgress> {
  if (opts.housekeeping !== false) await battleHousekeeping();
  const budget = opts.budgetMs ?? BATCH_BUDGET_MS;

  const pending = await pendingBattleNotices();
  const startedAt = Date.now();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let handled = 0;

  for (const p of pending.slice(0, BATCH_MAX)) {
    if (Date.now() - startedAt > budget) break;

    // Taken first, so a second run arriving together cannot send it too.
    // Taken either way: a failed send is not retried, because the commonest
    // failure is an address on the suppression list and that must stay
    // refused.
    const songs = await claim(p.songs);
    handled += 1;
    if (songs.length === 0) continue;

    // Somebody who has opted out, or whose address cannot receive mail, is
    // dealt with and simply not written to.
    if (p.optedOut || !isEmailAddress(p.email)) {
      skipped += 1;
      continue;
    }

    const result = await sendEmail(
      p.email,
      battleOpenEmail({
        songs: songs.map((s) => ({
          title: s.title,
          artistName: s.artistName,
          url: `${appUrl}/battles?b=${s.battleId}`,
        })),
        unsubscribeUrl: artistUnsubscribeUrl(p.artistId, appUrl),
      })
    );
    if (result.ok) sent += 1;
    else failed += 1;

    await new Promise((r) => setTimeout(r, PACE_MS));
  }

  const remaining = pending.length - handled;
  return { remaining, sent, failed, skipped, done: remaining <= 0 };
}
