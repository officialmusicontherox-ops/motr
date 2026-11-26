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

/** One send per week, naming every winner that week. No schema change needed. */
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

type Winner = Awaited<ReturnType<typeof prisma.chartWinner.findMany>>[number];

/** Top Artists first, then AI Artists, the same order as the Charts tab. */
function inOrder(ws: Winner[]): Winner[] {
  return [...ws].sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "regular" ? -1 : 1));
}

/** What the email and the admin preview are given, one per chart. */
function forEmail(ws: Winner[]) {
  return inOrder(ws).map((w) => ({
    chart: w.kind === "ai" ? ("ai" as const) : ("regular" as const),
    artistName: w.artistName,
    writeUpUrl: w.writeUpUrl as string,
  }));
}

/**
 * The most recent locked week whose write-ups are all in, and which has not
 * been announced.
 *
 * All of them: from 22 November 2026 a week has a Top Artists winner and an
 * AI Artists winner, and the one email names both, so it waits until both
 * links are pasted. A week where only one chart had a winner needs only that
 * one. Most recent rather than oldest: if a week was missed, announcing it
 * weeks later as "this week's winner" would be wrong.
 */
async function pending() {
  const rows = await prisma.chartWinner.findMany({ orderBy: { weekStart: "desc" }, take: 10 });
  const weeks = new Map<string, Winner[]>();
  for (const r of rows) {
    const k = r.weekStart.toISOString();
    weeks.set(k, [...(weeks.get(k) ?? []), r]);
  }
  for (const ws of weeks.values()) {
    if (ws.some((w) => !w.writeUpUrl)) continue;
    const claimed = await prisma.chartBlastSend.findUnique({
      where: { sentOn: claimKey(ws[0].weekStart) },
    });
    if (!claimed?.doneAt) return { winners: inOrder(ws), claimed };
  }
  return { winners: null, claimed: null };
}

/** "Name" or "Name and Name". */
function names(ws: { artistName: string }[]) {
  return ws.map((w) => w.artistName).join(" and ");
}

/** Who it would reach and what it would say. Sends nothing. */
export async function previewWinnerAnnounce(appUrl: string) {
  const [{ winners, claimed }, people] = await Promise.all([pending(), recipients(appUrl)]);

  if (!winners) {
    const latest = await prisma.chartWinner.findFirst({ orderBy: { weekStart: "desc" } });
    const week = latest
      ? await prisma.chartWinner.findMany({ where: { weekStart: latest.weekStart } })
      : [];
    const missing = inOrder(week).filter((w) => !w.writeUpUrl);
    return {
      ready: false as const,
      reason: !latest
        ? "No week has been locked yet, so there is no winner to announce."
        : missing.length > 0
          ? `Waiting on the write-up for ${missing
              .map((w) => `${w.artistName} (${w.kind === "ai" ? "AI Artists" : "Top Artists"})`)
              .join(" and ")}. The email goes out once every winner for the week has one.`
          : "Everyone has already been told about the latest winners.",
      recipients: people.length,
    };
  }

  return {
    ready: true as const,
    artistName: names(winners),
    winners: forEmail(winners),
    weekLabel: labelFor(winners[0].weekStart),
    writeUpUrl: winners[0].writeUpUrl as string,
    recipients: people.length,
    unfinished:
      claimed && !claimed.doneAt
        ? { cursor: claimed.cursor, total: claimed.recipients, sent: claimed.sent }
        : null,
  };
}

/** Send one batch, and say how far along it is. Called until done. */
export async function sendWinnerAnnounce(appUrl: string): Promise<WinnerAnnounceProgress> {
  const { winners } = await pending();
  if (!winners) {
    return {
      total: 0,
      cursor: 0,
      sent: 0,
      failed: 0,
      done: true,
      skipped:
        "Nothing to announce yet. The email goes out once both write-ups for the week are pasted in, and only once.",
    };
  }

  const key = claimKey(winners[0].weekStart);
  const artistName = names(winners);
  let row = await prisma.chartBlastSend.findUnique({ where: { sentOn: key } });

  if (row?.doneAt) {
    return {
      total: row.recipients,
      cursor: row.cursor,
      sent: row.sent,
      failed: row.failed,
      done: true,
      skipped: `${artistName} was already announced at ${clockTime(row.doneAt)}.`,
      artistName,
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
          weekLabel: labelFor(winners[0].weekStart),
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
        winners: forEmail(winners),
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

  return { total, cursor, sent, failed, done, artistName };
}
