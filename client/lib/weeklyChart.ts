import { prisma } from "./prisma";
import { weeklyLeaders } from "./scoutData";
import { unsubscribeUrl, artistUnsubscribeUrl } from "./nudges";
import { sendEmail, weeklyChartEmail } from "./email";

/**
 * The weekly chart email, to everyone who has an address and hasn't opted out.
 *
 * Listeners and artists both get it, for different reasons: a listener is
 * being shown what the crowd decided and given a way to influence it, and an
 * artist is being shown where they placed. The same email serves both, so
 * there is one thing to maintain rather than two that drift apart.
 *
 * Refuses to send an empty chart. A week with nothing in it is a week with no
 * news, and mailing eighty people to tell them nothing is how a list learns
 * to ignore you.
 *
 * Refuses to send at all before the start date. A chart is only worth reading
 * when enough has been played to make the order mean something, and the first
 * one setting that expectation badly is worse than it arriving later.
 */

/** Nothing goes out before this. */
export const CHART_EMAIL_START = new Date(Date.UTC(2026, 10, 1)); // 1 November 2026

/** Whether the chart email is allowed to send yet, and why not if it isn't. */
export function chartEmailNotYet(now = new Date()): string | null {
  if (now >= CHART_EMAIL_START) return null;
  const when = CHART_EMAIL_START.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `The weekly chart email starts on ${when}. Nothing is sent before then.`;
}

export type WeeklyChartResult = {
  recipients: number;
  sent: number;
  failed: number;
  skipped?: string;
  songs: number;
  artists: number;
};

type Recipient = { email: string; name: string; unsubscribe: string };

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

  const list: Recipient[] = [];
  const seen = new Set<string>();

  for (const fan of fans) {
    if (!fan.email) continue;
    const key = fan.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ email: fan.email, name: fan.username, unsubscribe: unsubscribeUrl(fan.id, appUrl) });
  }

  // An artist who also swipes has one address and should get one email, not
  // two. The listener row wins because it was added first and its unsubscribe
  // link is the one they'd expect.
  for (const artist of artists) {
    if (!artist.email) continue;
    const key = artist.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      email: artist.email,
      name: artist.name,
      unsubscribe: artistUnsubscribeUrl(artist.id, appUrl),
    });
  }

  return list;
}

/** Who would receive it and what it would say. Sends nothing. */
export async function previewWeeklyChart(appUrl: string) {
  const [leaders, people] = await Promise.all([weeklyLeaders(), recipients(appUrl)]);
  return {
    notYet: chartEmailNotYet(),
    recipients: people.length,
    songs: leaders.songs.map((s) => ({ title: s.title, artistName: s.artistName })),
    artists: leaders.artists.map((a) => ({ name: a.name })),
  };
}

export async function sendWeeklyChart(appUrl: string): Promise<WeeklyChartResult> {
  // Checked here rather than only in the dashboard, so a scheduled run or a
  // direct call cannot get round it either.
  const tooEarly = chartEmailNotYet();
  if (tooEarly) {
    return { recipients: 0, sent: 0, failed: 0, skipped: tooEarly, songs: 0, artists: 0 };
  }

  const leaders = await weeklyLeaders();
  const songs = leaders.songs.map((s) => ({ title: s.title, artistName: s.artistName }));
  const artists = leaders.artists.map((a) => ({ name: a.name }));

  if (songs.length === 0 && artists.length === 0) {
    return {
      recipients: 0,
      sent: 0,
      failed: 0,
      skipped: "Nothing was played this week, so there is no chart to send.",
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
      weeklyChartEmail({
        songs,
        artists,
        unsubscribeUrl: person.unsubscribe,
      })
    );
    result.ok ? (sent += 1) : (failed += 1);
  }

  return { recipients: people.length, sent, failed, songs: songs.length, artists: artists.length };
}
