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
export function lastCompleteWeek(at: Date = new Date()): Week {
  const current = weekOf(at);
  return weekOf(new Date(current.start.getTime() - 1));
}
