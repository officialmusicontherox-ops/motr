import { prisma } from "./prisma";
import { CHART_TZ } from "./weekWindow";
import { sendEmail, artistSharePageEmail } from "./email";
import { cardsFor, type SharePageRecipient } from "./artistSharePage";

/**
 * The share cards, sent to every artist at once.
 *
 * Distinct from the automatic one. That one tells an artist about their page
 * the first time, once, and never again; this is the deliberate mass send,
 * and it goes to everyone whether they have had it before or not. Pressing it
 * is the whole point, so it does not quietly decide somebody has had enough.
 *
 * Batched for the same reason the chart blast is: the function behind it has
 * about ten seconds, and every email here draws a card first, so only a few
 * artists fit in one request.
 */

/** Today in the chart's own zone, as YYYY-MM-DD. The day is the guard. */
function today(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHART_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * How much one request does.
 *
 * Far fewer than the chart blast because each of these draws a card before
 * it sends. A card measured at about a second and a half warm and nearly
 * eight cold, so two artists is already most of the ten seconds available.
 */
const BATCH_MAX = 2;
const BATCH_BUDGET_MS = 4500;
const PACE_MS = 550;
/**
 * Cards attached as files. One, because the body already shows a graphic for
 * every song and a card takes about a second and a half to draw: three of
 * them would not fit in the ten seconds the function gets, let alone on a
 * cold start, which measured at nearly eight.
 */
const ATTACH_CARDS = 1;

export type ShareBlastProgress = {
  total: number;
  cursor: number;
  sent: number;
  failed: number;
  done: boolean;
  skipped?: string;
};

/** The send already made today, if there was one. */
export async function sentToday() {
  return prisma.shareBlastSend.findUnique({ where: { sentOn: today() } });
}

function clockTime(at: Date) {
  return at.toLocaleString("en-US", {
    timeZone: CHART_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Every artist with music in the feed who has not opted out.
 *
 * No check on whether they have had this before, which is what separates
 * this from the automatic send.
 */
async function everyArtist(): Promise<SharePageRecipient[]> {
  const rows = await prisma.artist.findMany({
    where: {
      emailOptOut: false,
      tracks: { some: { status: { not: "REJECTED" } } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      tracks: {
        where: { status: { not: "REJECTED" } },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, artworkUrl: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows
    .filter((a) => a.email && a.tracks.length > 0)
    .map((a) => ({ artistId: a.id, name: a.name, email: a.email, tracks: a.tracks }));
}

/** Who it would reach. Sends nothing. */
export async function previewShareBlast() {
  const [people, already] = await Promise.all([everyArtist(), sentToday()]);
  return {
    recipients: people.length,
    alreadySentToday: already?.doneAt ? clockTime(already.doneAt) : null,
    unfinished:
      already && !already.doneAt
        ? { cursor: already.cursor, total: already.recipients, sent: already.sent }
        : null,
  };
}

/**
 * Send one batch of share cards, and say how far along the send is.
 *
 * Called repeatedly until `done`. The first call claims the day and
 * snapshots the artist list; each later one picks up at the cursor the last
 * one left. The cursor advances past an artist whether their send succeeded
 * or failed, because a retry is worth less than the risk of a duplicate.
 */
export async function sendShareBlast(): Promise<ShareBlastProgress> {
  const day = today();
  let row = await prisma.shareBlastSend.findUnique({ where: { sentOn: day } });

  if (row?.doneAt) {
    return {
      total: row.recipients,
      cursor: row.cursor,
      sent: row.sent,
      failed: row.failed,
      done: true,
      skipped: `The share cards already went out today at ${clockTime(row.doneAt)}. One mass send a day.`,
    };
  }

  if (!row) {
    // Checked before the day is claimed, so an empty list cannot use up the
    // one send available today.
    const people = await everyArtist();
    if (people.length === 0) {
      return {
        total: 0,
        cursor: 0,
        sent: 0,
        failed: 0,
        done: true,
        skipped: "No artist has music in the feed, so there is nothing to send.",
      };
    }

    /**
     * One mass send a day, and the day is claimed before anything is sent.
     *
     * A unique row per day rather than a check on the clock: two presses
     * arriving together would both pass a read-then-write, and a second
     * mailing to every artist cannot be recalled.
     */
    try {
      row = await prisma.shareBlastSend.create({
        data: { sentOn: day, recipients: people.length, queue: JSON.stringify(people) },
      });
    } catch {
      row = await prisma.shareBlastSend.findUnique({ where: { sentOn: day } });
      if (!row) throw new Error("Could not claim today's send.");
      if (row.doneAt) {
        return {
          total: row.recipients,
          cursor: row.cursor,
          sent: row.sent,
          failed: row.failed,
          done: true,
          skipped: `The share cards already went out today at ${clockTime(row.doneAt)}. One mass send a day.`,
        };
      }
    }
  }

  let queue: SharePageRecipient[] | null = null;
  try {
    queue = row.queue ? (JSON.parse(row.queue) as SharePageRecipient[]) : null;
  } catch {
    queue = null;
  }
  if (!queue) {
    // Rebuilding beats stranding the day. The cursor still says who has been
    // reached, and the list is built the same way every time.
    queue = await everyArtist();
    await prisma.shareBlastSend.update({
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
    const artist = queue[cursor];
    const attachments = await cardsFor(artist, ATTACH_CARDS);
    const result = await sendEmail(
      artist.email,
      artistSharePageEmail({ name: artist.name, tracks: artist.tracks, attachments })
    );

    if (result.ok) {
      sent += 1;
      // Keeps the "told" column in the artist view meaningful: it says when
      // they last had this, not only whether they ever did.
      await prisma.artist
        .update({ where: { id: artist.artistId }, data: { sharePageEmailAt: new Date() } })
        .catch(() => {});
    } else {
      failed += 1;
    }
    cursor += 1;

    // Stop on the budget as well as the count, so a slow card still leaves
    // time to record the work instead of being killed with it lost.
    if (cursor >= total || Date.now() - startedAt > BATCH_BUDGET_MS) break;
    await new Promise((r) => setTimeout(r, PACE_MS));
  }

  const done = cursor >= total;
  await prisma.shareBlastSend.update({
    where: { id: row.id },
    data: { cursor, sent, failed, doneAt: done ? new Date() : null },
  });

  return { total, cursor, sent, failed, done };
}
