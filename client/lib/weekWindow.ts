/**
 * The chart week: Sunday 00:00 to Saturday 23:59, in US Central.
 *
 * Anchored to a real place rather than to UTC because the cutoff is something
 * people are told about. "Closes Saturday at midnight" has to mean the
 * listener's Saturday night; computed in UTC it would land at 6pm or 7pm
 * Central on Saturday, which is neither midnight nor Saturday for anyone
 * reading it.
 *
 * Central because that is where this is run from and where the audience
 * mostly is. One zone, stated once, is better than a boundary that drifts
 * with whoever is looking.
 */

export const CHART_TZ = "America/Chicago";

/**
 * The first day the weekly chart counts for anything.
 *
 * One constant for the whole app. The write-up board had its own, set a month
 * earlier, so it offered October weeks to lock in and write about while the
 * recap emails correctly refused to send for them.
 */
export const CHART_START = new Date(Date.UTC(2026, 10, 1)); // 1 November 2026

/** "1 November 2026", for telling someone when it begins. */
export const CHART_START_LABEL = "1 November 2026";

/**
 * How far ahead of UTC the zone is at a given instant, in milliseconds.
 *
 * Derived from the formatter rather than hard-coded, so daylight saving is
 * handled without a table: Central is -5 hours in October and -6 in
 * November, and the week boundary has to move with it.
 */
function zoneOffsetMs(at: Date, timeZone = CHART_TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(at)
    .filter((p) => p.type !== "literal");

  const v = Object.fromEntries(parts.map((p) => [p.type, Number(p.value)])) as Record<
    string,
    number
  >;
  // hour comes back as 24 at midnight under hour12:false in some runtimes.
  const asIfUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour % 24, v.minute, v.second);
  return asIfUtc - at.getTime();
}

/** The instant of local midnight on a given calendar date in the zone. */
function zonedMidnight(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  // Two passes: the offset itself depends on the instant, and a date that
  // falls on a daylight-saving change needs the corrected one.
  const first = guess - zoneOffsetMs(new Date(guess));
  return new Date(guess - zoneOffsetMs(new Date(first)));
}

/** The calendar date, in the chart's zone, that an instant falls on. */
function localDate(at: Date): { year: number; month: number; day: number; weekday: number } {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: CHART_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(at);
  const v = Object.fromEntries(f.map((p) => [p.type, p.value]));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(v.year),
    month: Number(v.month),
    day: Number(v.day),
    weekday: days.indexOf(v.weekday),
  };
}

export type Week = {
  /** Inclusive start: Sunday 00:00 Central, as a UTC instant. */
  start: Date;
  /** Exclusive end: the following Sunday 00:00 Central. */
  end: Date;
  /** "October 4 - October 10" */
  label: string;
  /** "Week of October 4" */
  shortLabel: string;
};

function format(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHART_TZ,
    month: "long",
    day: "numeric",
  }).format(d);
}

/** The Sunday-to-Saturday week containing an instant. */
export function weekOf(at: Date = new Date()): Week {
  const { year, month, day, weekday } = localDate(at);
  const sunday = zonedMidnight(year, month, day - weekday);
  const end = new Date(sunday.getTime());
  // Built by date rather than by adding 7 days of milliseconds, so the week
  // containing a daylight-saving change is still seven days long.
  const s = localDate(sunday);
  const next = zonedMidnight(s.year, s.month, s.day + 7);

  // The last moment inside the week, for the label.
  const saturday = new Date(next.getTime() - 1);
  void end;

  return {
    start: sunday,
    end: next,
    label: `${format(sunday)} - ${format(saturday)}`,
    shortLabel: `Week of ${format(sunday)}`,
  };
}

/** The most recent week that has finished. */
/**
 * The first week the archive offers.
 *
 * The chart itself begins on 1 November, but the weeks before it still have
 * real standings and are worth being able to look back at. Fixed rather than
 * rolling, so the list grows by one each Sunday instead of a week quietly
 * dropping off the end.
 */
export const ARCHIVE_START = new Date(Date.UTC(2026, 9, 18)); // Sunday 18 October 2026

/**
 * Every week from the archive's start up to the one in progress, newest
 * first. The key is the Sunday as YYYY-MM-DD, which is what a request names.
 */
export function selectableWeeks(at: Date = new Date()): { key: string; label: string; shortLabel: string }[] {
  const out: { key: string; label: string; shortLabel: string }[] = [];
  let w = weekOf(at);
  // Guarded rather than while(true): a bad clock should not spin forever.
  for (let i = 0; i < 520 && w.start >= ARCHIVE_START; i++) {
    out.push({ key: weekKey(w), label: w.label, shortLabel: w.shortLabel });
    w = weekOf(new Date(w.start.getTime() - 1));
  }
  return out;
}

/** The Sunday of a week, as YYYY-MM-DD in the chart's own zone. */
export function weekKey(w: Week): string {
  const { year, month, day } = localDate(w.start);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The week a key names, or the current one if it names nothing valid. */
export function weekFromKey(key: string | null, at: Date = new Date()): Week {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return weekOf(at);
  const [y, m, d] = key.split("-").map(Number);
  const asked = weekOf(zonedMidnight(y, m, d));
  // Nothing before the archive and nothing in the future.
  if (asked.start < ARCHIVE_START || asked.start > weekOf(at).start) return weekOf(at);
  return asked;
}

export function lastCompleteWeek(at: Date = new Date()): Week {
  const current = weekOf(at);
  return weekOf(new Date(current.start.getTime() - 1));
}

export type PeriodUnit = "day" | "week" | "month" | "year";

/**
 * The period a report is actually about.
 *
 * The dashboard used to sum its whole series, so "Weekly" showed twelve weeks
 * of swipes under a heading that said Weekly. These are the current day, week,
 * month and year, in the chart's zone, so a number under a tab means the thing
 * the tab is named after.
 */
export function periodWindow(unit: PeriodUnit, at: Date = new Date()): Week {
  const { year, month, day, weekday } = localDate(at);

  if (unit === "week") return weekOf(at);

  const start =
    unit === "day"
      ? zonedMidnight(year, month, day)
      : unit === "month"
        ? zonedMidnight(year, month, 1)
        : zonedMidnight(year, 1, 1);

  const end =
    unit === "day"
      ? zonedMidnight(year, month, day + 1)
      : unit === "month"
        ? zonedMidnight(year, month + 1, 1)
        : zonedMidnight(year + 1, 1, 1);

  void weekday;

  const label =
    unit === "day"
      ? `Today, ${format(start)}`
      : unit === "month"
        ? new Intl.DateTimeFormat("en-US", { timeZone: CHART_TZ, month: "long", year: "numeric" }).format(start)
        : String(year);

  return { start, end, label, shortLabel: label };
}
