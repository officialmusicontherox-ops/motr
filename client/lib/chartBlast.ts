import { prisma } from "./prisma";
import { leadersBetween } from "./scoutData";
import { weekOf, CHART_TZ } from "./weekWindow";
import { sendEmail, weeklyChartEmail } from "./email";

/**
 * This week's charts, sent on demand.
 *
 * Separate from the scheduled chart-winner mail and deliberately ungated: the
 * point of this one is that it goes whenever the button is pressed, however
 * far into the week that is.
 *
 * The window is the same calendar week the Charts page shows, built from
 * weekOf rather than a rolling seven days, so what lands in an inbox matches
 * what the site says when somebody follows the link to check.
 */

/** Today in the chart's own zone, as YYYY-MM-DD. The day is the guard. */
function today(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHART_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

/** The send already made today, if there was one. */
export async function sentToday() {
  return prisma.chartBlastSend.findUnique({ where: { sentOn: today() } });
}

export type ChartBlastProgress = {
  /** Addresses in the snapshot. Fixed once the send starts. */
  total: number;
  /** How many have been reached, successes and failures together. */
  cursor: number;
  sent: number;
  failed: number;
  done: boolean;
  /** Set when nothing was sent and nothing will be, with the reason. */
  skipped?: string;
  weekLabel: string;
  songs: number;
  artists: number;
};

/**
 * How much one request does.
 *
 * The function that serves this has about ten seconds before Netlify kills
 * it, so a mailing of any size cannot be made in one. The browser asks
 * repeatedly instead, and each request stops on whichever of these comes
 * first, leaving the rest for the next one.
 */
const BATCH_MAX = 10;
const BATCH_BUDGET_MS = 4500;
/** Under Resend's two-a-second ceiling, the same as every other batch here. */
const PACE_MS = 550;

type Recipient = { email: string; name: string; unsubscribe: string };

/**
 * Everyone with an address who has not opted out, listeners and artists
 * alike, deduplicated. Somebody who is both gets one copy.
 */
async function recipients(appUrl: string): Promise<Recipient[]> {
  const [fans, artists] = await Promise.all([
    prisma.fan.findMany({
      where: { email: { not: null }, emailOptOut: false },
      select: { id: true, email: true, username: true },
    }),
    prisma.artist.findMany({
      where: { emailOptOut: false },
      select: { id: true, email: true, name: true },
    }),
  ]);

  const seen = new Set<string>();
  const list: Recipient[] = [];

  for (const f of fans) {
    const email = (f.email ?? "").trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    list.push({
      email,
      name: f.username,
      unsubscribe: `${appUrl}/unsubscribe?fan=${f.id}`,
    });
  }
  for (const a of artists) {
    const email = (a.email ?? "").trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    list.push({
      email,
      name: a.name,
      unsubscribe: `${appUrl}/unsubscribe?artist=${a.id}`,
    });
  }
  return list;
}

async function thisWeek() {
  const week = weekOf();
  const leaders = await leadersBetween(week.start, week.end);
  return {
    week,
    songs: leaders.songs.map((s) => ({ title: s.title, artistName: s.artistName })),
    artists: leaders.artists.map((a) => ({ name: a.name })),
  };
}

/** What a day's claim carries, so each batch mails exactly what the first one would have. */
type Queue = {
  songs: { title: string; artistName: string }[];
  artists: { name: string }[];
  people: Recipient[];
};

function clockTime(at: Date) {
  return at.toLocaleString("en-US", {
    timeZone: CHART_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Who it would reach and what it would say. Sends nothing. */
export async function previewChartBlast(appUrl: string) {
  const [{ week, songs, artists }, people, already] = await Promise.all([
    thisWeek(),
    recipients(appUrl),
    sentToday(),
  ]);
  return {
    recipients: people.length,
    weekLabel: week.label,
    songs,
    artists,
    // So the button can say so before it is pressed, rather than after.
    alreadySentToday: already?.doneAt ? clockTime(already.doneAt) : null,
    // A send that stopped partway, so the button can offer to finish it
    // instead of looking like the day is spent.
    unfinished:
      already && !already.doneAt
        ? { cursor: already.cursor, total: already.recipients, sent: already.sent }
        : null,
  };
}

/**
 * Send one batch of this week's charts, and say how far along the send is.
 *
 * Called repeatedly by the dashboard until `done`. The first call claims the
 * day and snapshots what is being sent; each later one picks up at the cursor
 * the last one left. Nothing is sent twice: the cursor advances past an
 * address whether its send succeeded or failed, because a second attempt at
 * a bad address is worth less than the risk of a duplicate at a good one.
 */
export async function sendChartBlast(appUrl: string): Promise<ChartBlastProgress> {
  const day = today();
  let row = await prisma.chartBlastSend.findUnique({ where: { sentOn: day } });

  if (row?.doneAt) {
    return {
      total: row.recipients,
      cursor: row.cursor,
      sent: row.sent,
      failed: row.failed,
      done: true,
      skipped: `This week's charts already went out today at ${clockTime(row.doneAt)}. One batch a day.`,
      weekLabel: row.weekLabel,
      songs: 0,
      artists: 0,
    };
  }

  const { week, songs, artists } = await thisWeek();

  if (!row) {
    // Everything is checked before the day is claimed, so a week with nothing
    // in it cannot use up the one send available today.
    if (songs.length === 0 && artists.length === 0) {
      return {
        total: 0,
        cursor: 0,
        sent: 0,
        failed: 0,
        done: true,
        skipped: "Nothing has been played this week yet, so there is no chart to send.",
        weekLabel: week.label,
        songs: 0,
        artists: 0,
      };
    }

    const people = await recipients(appUrl);
    if (people.length === 0) {
      return {
        total: 0,
        cursor: 0,
        sent: 0,
        failed: 0,
        done: true,
        skipped: "Nobody has an address to send to.",
        weekLabel: week.label,
        songs: songs.length,
        artists: artists.length,
      };
    }

    /**
     * One batch a day, and the day is claimed before anything is sent.
     *
     * A unique row per day rather than a check on the clock: two presses
     * arriving together would both pass a read-then-write, and the second
     * mailing cannot be recalled. Whoever inserts the row owns the send.
     */
    const queue: Queue = { songs, artists, people };
    try {
      row = await prisma.chartBlastSend.create({
        data: {
          sentOn: day,
          weekLabel: week.label,
          recipients: people.length,
          queue: JSON.stringify(queue),
        },
      });
    } catch {
      row = await prisma.chartBlastSend.findUnique({ where: { sentOn: day } });
      if (!row) throw new Error("Could not claim today's send.");
      if (row.doneAt) {
        return {
          total: row.recipients,
          cursor: row.cursor,
          sent: row.sent,
          failed: row.failed,
          done: true,
          skipped: `This week's charts already went out today at ${clockTime(row.doneAt)}. One batch a day.`,
          weekLabel: row.weekLabel,
          songs: 0,
          artists: 0,
        };
      }
    }
  }

  // A claim made before the snapshot existed, or one that somehow lost it.
  // Rebuilding is better than stranding the day: the cursor still says who
  // has been reached, and the list is built the same way every time.
  let queue: Queue | null = null;
  try {
    queue = row.queue ? (JSON.parse(row.queue) as Queue) : null;
  } catch {
    queue = null;
  }
  if (!queue) {
    queue = { songs, artists, people: await recipients(appUrl) };
    await prisma.chartBlastSend.update({
      where: { id: row.id },
      data: { queue: JSON.stringify(queue), recipients: queue.people.length },
    });
  }

  const total = queue.people.length;
  let cursor = row.cursor;
  let sent = row.sent;
  let failed = row.failed;
  const startedAt = Date.now();

  while (cursor < total && cursor - row.cursor < BATCH_MAX) {
    const person = queue.people[cursor];
    const result = await sendEmail(
      person.email,
      weeklyChartEmail({
        songs: queue.songs,
        artists: queue.artists,
        weekLabel: row.weekLabel,
        unsubscribeUrl: person.unsubscribe,
      })
    );
    result.ok ? (sent += 1) : (failed += 1);
    cursor += 1;

    // Stop on the budget rather than only on the count, so a slow batch
    // still returns something the dashboard can record instead of being
    // killed with the batch's work lost.
    if (cursor >= total || Date.now() - startedAt > BATCH_BUDGET_MS) break;
    await new Promise((r) => setTimeout(r, PACE_MS));
  }

  const done = cursor >= total;
  await prisma.chartBlastSend.update({
    where: { id: row.id },
    data: { cursor, sent, failed, doneAt: done ? new Date() : null },
  });

  return {
    total,
    cursor,
    sent,
    failed,
    done,
    weekLabel: row.weekLabel,
    songs: queue.songs.length,
    artists: queue.artists.length,
  };
}
