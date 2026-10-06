import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { lastCompleteWeek, CHART_TZ, type Week } from "./weekWindow";
import { sendEmail, weeklyRecapEmail, type Attachment } from "./email";
import { renderShareCard } from "./shareCard";

/**
 * What each artist's week came to, sent on a Sunday morning.
 *
 * Only to artists something happened to. An artist who placed is told where,
 * and gets a graphic saying so, because the person most likely to promote
 * MOTR this week is the one who just did well on it. An artist who did not
 * place is told their own number instead. An artist whose music was not kept
 * at all is told nothing: a weekly note amounting to "nobody listened" is how
 * a mailing list dies.
 */

/** Nothing before this. The chart needs enough in it to be worth reading. */
export const RECAP_START = new Date(Date.UTC(2026, 10, 1)); // 1 November 2026

/** Only the top this many are told a position. Below that it reads as a rebuke. */
const PLACES = 10;

type Row = { artistId: string; name: string; email: string; saves: bigint; topTrack: string | null };

/** Every artist with a save in the week, best first. */
async function weekStandings(week: Week) {
  return prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT t."artistId" AS "artistId",
      MIN(a."name") AS name,
      MIN(a."email") AS email,
      COUNT(*) FILTER (WHERE s."direction" = 'RIGHT')::bigint AS saves,
      (ARRAY_AGG(t."title" ORDER BY t."fanRightSwipes" DESC))[1] AS "topTrack"
    FROM "Track" t
    JOIN "Artist" a ON a."id" = t."artistId"
    JOIN "FanSwipe" s ON s."trackId" = t."id"
    WHERE t."artistId" IS NOT NULL
      AND t."status" <> 'REJECTED'
      AND a."emailOptOut" = false
      AND s."createdAt" >= ${week.start}
      AND s."createdAt" < ${week.end}
    GROUP BY t."artistId"
    HAVING COUNT(*) FILTER (WHERE s."direction" = 'RIGHT') > 0
    ORDER BY saves DESC
  `);
}

export type Recap = {
  artistId: string;
  name: string;
  email: string;
  saves: number;
  position: number | null;
  /** Their best-performing track that week, for the graphic. */
  track: { id: string; title: string; artworkUrl: string | null } | null;
};

/** Who would be written to for a given week, and what each would be told. */
export async function recapsFor(week: Week): Promise<Recap[]> {
  const rows = await weekStandings(week);
  const already = await prisma.weeklyRecapSend.findMany({
    where: { weekStart: week.start },
    select: { artistId: true },
  });
  const sent = new Set(already.map((a) => a.artistId));

  const out: Recap[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (sent.has(r.artistId)) continue;

    const track = r.topTrack
      ? await prisma.track.findFirst({
          where: { artistId: r.artistId, title: r.topTrack },
          select: { id: true, title: true, artworkUrl: true },
        })
      : null;

    out.push({
      artistId: r.artistId,
      name: r.name,
      email: r.email,
      saves: Number(r.saves),
      position: i < PLACES ? i + 1 : null,
      track,
    });
  }
  return out;
}

/** Whether a recap is due right now, and for which week. */
export function recapDue(now = new Date()): { due: boolean; week: Week; why: string } {
  const week = lastCompleteWeek(now);

  if (week.start < RECAP_START) {
    return { due: false, week, why: `The weekly recap starts on 1 November 2026.` };
  }

  // Sunday morning in the chart's own zone, so the schedule can run hourly
  // and not care which side of a daylight-saving change it is on.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHART_TZ,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1) % 24;

  if (weekday !== "Sun") return { due: false, week, why: `Recaps go out on Sunday (it is ${weekday}).` };
  if (hour !== 10) return { due: false, week, why: `Recaps go out at 10am Central (it is ${hour}:00).` };

  return { due: true, week, why: "" };
}

async function cardFor(r: Recap, position: number): Promise<Attachment[]> {
  if (!r.track) return [];
  try {
    // Square rather than story: a chart result gets posted to a feed as often
    // as to a story, and it is less than half the weight.
    const res = await renderShareCard({
      trackId: r.track.id,
      title: r.track.title,
      artistName: r.name,
      artworkUrl: r.track.artworkUrl,
      square: true,
    });
    return [
      {
        filename: `motr-number-${position}-this-week.png`,
        content: Buffer.from(await res.arrayBuffer()),
      },
    ];
  } catch {
    // A graphic that will not draw must not cost them the email.
    return [];
  }
}

export async function sendWeeklyRecaps(appUrl: string, opts: { force?: boolean } = {}) {
  const { due, week, why } = recapDue();
  if (!due && !opts.force) return { skipped: why, week: week.label, eligible: 0, sent: 0, failed: 0 };

  const recaps = await recapsFor(week);
  let sent = 0;
  let failed = 0;

  for (const r of recaps) {
    const attachments = r.position ? await cardFor(r, r.position) : [];
    const result = await sendEmail(
      r.email,
      weeklyRecapEmail({
        name: r.name,
        week: week.label,
        position: r.position,
        saves: r.saves,
        trackTitle: r.track?.title ?? null,
        attachments,
        appUrl,
      })
    );

    if (!result.ok) {
      failed += 1;
      continue;
    }
    sent += 1;
    // Written as it goes, so a retry after a partial failure never mails
    // anyone twice.
    await prisma.weeklyRecapSend
      .create({ data: { artistId: r.artistId, weekStart: week.start, position: r.position } })
      .catch(() => {});
  }

  return { skipped: null, week: week.label, eligible: recaps.length, sent, failed };
}
