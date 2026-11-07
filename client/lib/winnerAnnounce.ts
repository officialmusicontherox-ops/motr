import { prisma } from "./prisma";
import { CHART_TZ, weekOf } from "./weekWindow";
import { sendEmail, chartWinnerEmail } from "./email";
import { recipients } from "./chartBlast";

/**
 * Telling everyone who won, once the write-up exists.
 *
 * Deliberately not fired by pasting the URL. A paste is how a typo gets
 * corrected, and a mailing to every address on the platform must not be the
 * side effect of fixing a link. The paste records the article; this sends it,
 * on a press, with the same preview and confirm as every other mailing here.
 *
 * Batched for the same reason the chart blast is: the function gets about
 * ten seconds and the list is far longer than that.
 */

const BATCH_MAX = 10;
const BATCH_BUDGET_MS = 4500;
const PACE_MS = 550;

/** One send per winner, keyed by their week. No schema change needed. */
function claimKey(weekStart: Date): string {
  return `winner:${weekStart.toISOString().slice(0, 10)}`;
}

function clockTime(at: Date) {
  return at.toLocaleString("en-US", {
    timeZone: CHART_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Label for the seven days the winner won, "November 1 - November 7". */
function labelFor(weekStart: Date): string {
  return weekOf(new Date(weekStart.getTime() + 36 * 60 * 60 * 1000)).label;
}

export type WinnerAnnounceProgress = {
  total: number;
  cursor: number;
  sent: number;
  failed: number;
  done: boolean;
  skipped?: string;
  artistName?: string;
};

/**
 * The most recent locked week that has a write-up and has not been announced.
 *
 * Most recent rather than oldest: if a week was missed, announcing it weeks
 * later as "this week's winner" would be wrong, and the newest is always the
 * one the user has just written.
 */
async function pending() {
  const winners = await prisma.chartWinner.findMany({
    where: { writeUpUrl: { not: null } },
    orderBy: { weekStart: "desc" },
    take: 5,
  });
  for (const w of winners) {
    const claimed = await prisma.chartBlastSend.findUnique({
      where: { sentOn: claimKey(w.weekStart) },
    });
    if (!claimed?.doneAt) return { winner: w, claimed };
  }
  return { winner: null, claimed: null };
}

/** Who it would reach and what it would say. Sends nothing. */
export async function previewWinnerAnnounce(appUrl: string) {
  const [{ winner, claimed }, people] = await Promise.all([pending(), recipients(appUrl)]);

  if (!winner) {
    const latest = await prisma.chartWinner.findFirst({ orderBy: { weekStart: "desc" } });
    return {
      ready: false as const,
      reason: !latest
        ? "No week has been locked yet, so there is no winner to announce."
        : !latest.writeUpUrl
          ? `${latest.artistName} won the latest locked week, but no write-up link has been pasted in yet.`
          : "Everyone has already been told about the latest winner.",
      recipients: people.length,
    };
  }

  return {
    ready: true as const,
    artistName: winner.artistName,
    weekLabel: labelFor(winner.weekStart),
    writeUpUrl: winner.writeUpUrl as string,
    recipients: people.length,
    unfinished:
      claimed && !claimed.doneAt
        ? { cursor: claimed.cursor, total: claimed.recipients, sent: claimed.sent }
        : null,
  };
}

/** Send one batch, and say how far along it is. Called until done. */
export async function sendWinnerAnnounce(appUrl: string): Promise<WinnerAnnounceProgress> {
  const { winner } = await pending();
  if (!winner) {
    return {
      total: 0,
      cursor: 0,
      sent: 0,
      failed: 0,
      done: true,
      skipped: "Nothing to announce: either no write-up has been pasted in, or it has already gone out.",
    };
  }

  const key = claimKey(winner.weekStart);
  let row = await prisma.chartBlastSend.findUnique({ where: { sentOn: key } });

  if (row?.doneAt) {
    return {
      total: row.recipients,
      cursor: row.cursor,
      sent: row.sent,
      failed: row.failed,
      done: true,
      skipped: `${winner.artistName} was already announced at ${clockTime(row.doneAt)}.`,
      artistName: winner.artistName,
    };
  }

  if (!row) {
    const people = await recipients(appUrl);
    if (people.length === 0) {
      return { total: 0, cursor: 0, sent: 0, failed: 0, done: true, skipped: "Nobody has an address." };
    }
    try {
      row = await prisma.chartBlastSend.create({
        data: {
          sentOn: key,
          weekLabel: labelFor(winner.weekStart),
          recipients: people.length,
          queue: JSON.stringify(people),
        },
      });
    } catch {
      row = await prisma.chartBlastSend.findUnique({ where: { sentOn: key } });
      if (!row) throw new Error("Could not claim this announcement.");
    }
  }

  let queue: { email: string; name: string; unsubscribe: string }[] | null = null;
  try {
    queue = row.queue ? JSON.parse(row.queue) : null;
  } catch {
    queue = null;
  }
  if (!queue) {
    queue = await recipients(appUrl);
    await prisma.chartBlastSend.update({
      where: { id: row.id },
      data: { queue: JSON.stringify(queue), recipients: queue.length },
    });
  }

  const total = queue.length;
  let cursor = row.cursor;
  let sent = row.sent;
  let failed = row.failed;
  const startedAt = Date.now();

  while (cursor < total && cursor - row.cursor < BATCH_MAX) {
    const person = queue[cursor];
    const result = await sendEmail(
      person.email,
      chartWinnerEmail({
        artistName: winner.artistName,
        writeUpUrl: winner.writeUpUrl as string,
        weekLabel: row.weekLabel,
        unsubscribeUrl: person.unsubscribe,
      })
    );
    result.ok ? (sent += 1) : (failed += 1);
    cursor += 1;
    if (cursor >= total || Date.now() - startedAt > BATCH_BUDGET_MS) break;
    await new Promise((r) => setTimeout(r, PACE_MS));
  }

  const done = cursor >= total;
  await prisma.chartBlastSend.update({
    where: { id: row.id },
    data: { cursor, sent, failed, doneAt: done ? new Date() : null },
  });

  return { total, cursor, sent, failed, done, artistName: winner.artistName };
}
