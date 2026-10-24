import { prisma } from "./prisma";
import { leadersBetween } from "./scoutData";
import { weekOf } from "./weekWindow";
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
  const [{ week, songs, artists }, people] = await Promise.all([thisWeek(), recipients(appUrl)]);
  return {
    recipients: people.length,
    weekLabel: week.label,
    songs,
    artists,
  };
}

export async function sendChartBlast(appUrl: string): Promise<ChartBlastResult> {
  const { week, songs, artists } = await thisWeek();

  if (songs.length === 0 && artists.length === 0) {
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

  return {
    recipients: people.length,
    sent,
    failed,
    weekLabel: week.label,
    songs: songs.length,
    artists: artists.length,
  };
}
