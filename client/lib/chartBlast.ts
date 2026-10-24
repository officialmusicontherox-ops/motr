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

export type ChartBlastResult = {
  recipients: number;
  sent: number;
  failed: number;
  skipped?: string;
  weekLabel: string;
  songs: number;
  artists: number;
};

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
    alreadySentToday: already
      ? already.sentAt.toLocaleString("en-US", { timeZone: CHART_TZ, hour: "numeric", minute: "2-digit", hour12: true })
      : null,
  };
}

export async function sendChartBlast(appUrl: string): Promise<ChartBlastResult> {
  const { week, songs, artists } = await thisWeek();

  /**
   * One batch a day, and the day is claimed before anything is sent.
   *
   * A unique row per day rather than a check on the clock: two presses
   * arriving together would both pass a read-then-write, and the second
   * mailing cannot be recalled. Whoever inserts the row sends; the other is
   * told it has already gone.
   */
  const day = today();
  try {
    await prisma.chartBlastSend.create({
      data: { sentOn: day, weekLabel: week.label },
    });
  } catch {
    const already = await prisma.chartBlastSend.findUnique({ where: { sentOn: day } });
    const when = already?.sentAt
      ? already.sentAt.toLocaleString("en-US", { timeZone: CHART_TZ, hour: "numeric", minute: "2-digit", hour12: true })
      : "earlier";
    return {
      recipients: 0,
      sent: 0,
      failed: 0,
      skipped: `This week's charts already went out today at ${when}. One batch a day.`,
      weekLabel: week.label,
      songs: 0,
      artists: 0,
    };
  }

  if (songs.length === 0 && artists.length === 0) {
    // The day was claimed before this was known, so hand it back: a week with
    // nothing in it must not use up the one send available today.
    await prisma.chartBlastSend.delete({ where: { sentOn: day } }).catch(() => {});
    return {
      recipients: 0,
      sent: 0,
      failed: 0,
      skipped: "Nothing has been played this week yet, so there is no chart to send.",
      weekLabel: week.label,
      songs: 0,
      artists: 0,
    };
  }

  const people = await recipients(appUrl);
  let sent = 0;
  let failed = 0;

  for (const person of people) {
    const result = await sendEmail(
      person.email,
      weeklyChartEmail({ songs, artists, weekLabel: week.label, unsubscribeUrl: person.unsubscribe })
    );
    result.ok ? (sent += 1) : (failed += 1);
    // Paced under Resend's limit, the same as every other batch here.
    await new Promise((r) => setTimeout(r, 600));
  }

  await prisma.chartBlastSend
    .update({ where: { sentOn: day }, data: { recipients: people.length, sent, failed } })
    .catch(() => {});

  return {
    recipients: people.length,
    sent,
    failed,
    weekLabel: week.label,
    songs: songs.length,
    artists: artists.length,
  };
}
