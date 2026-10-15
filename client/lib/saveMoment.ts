/**
 * The line shown when someone keeps a track.
 *
 * Only ever on a right swipe. A pass reveals nothing and says nothing, or the
 * feed becomes a way to look up who made something without backing it.
 *
 * Everything here is a fact about this save, drawn from what the swipe
 * response already returns. No invented badges: "fourth person to keep this"
 * flatters harder than "Elite Ear" because it is specific and true, and
 * nobody else got that exact line. The number is the compliment.
 *
 * Repetition is the thing that kills it. Saves run at roughly a fifth of
 * swipes, so a busy session produces several of these, and the same sentence
 * twice reads as a canned response rather than a reaction. Two defences: the
 * triggers are checked in order of how rare they are, and anything used
 * recently is skipped in favour of something that has not been.
 */

import { FULL_LISTEN_MS } from "./economics";

/** How many recent lines to avoid repeating. */
const MEMORY = 4;

const recentKinds: string[] = [];
const recentTexts: string[] = [];

function remember(list: string[], value: string): void {
  list.push(value);
  while (list.length > MEMORY) list.shift();
}

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "3 days" / "5 hours" / "a few minutes", for how long a track has been up. */
export function sinceLabel(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return "a few minutes";
  if (hours < 2) return "an hour";
  if (hours < 24) return `${Math.round(hours)} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? "a day" : `${days} days`;
}

export type SaveFacts = {
  /** Their place in the list of people who have kept it, 1 = first ever. */
  position: number;
  /** How much of the clip they heard, in milliseconds. */
  listenMs: number | null;
  /** When the track was submitted. */
  createdAt?: string | Date | null;
  /** How many this person has kept in total, including this one. */
  savedTotal?: number;
};

type Candidate = { kind: string; lines: string[] };

/**
 * Ordered rarest first. The first few are things that are true of almost no
 * other save, which is what makes them worth saying.
 */
function candidates(f: SaveFacts): Candidate[] {
  const out: Candidate[] = [];
  const n = f.position;
  const heardItOut = f.listenMs != null && f.listenMs >= FULL_LISTEN_MS;

  if (n === 1) {
    out.push({
      kind: "first",
      lines: [
        "You're the first person ever to keep this.",
        "Nobody had kept this before you.",
        "First save this track has ever had.",
      ],
    });
  }

  if (f.createdAt) {
    const age = Date.now() - new Date(f.createdAt).getTime();
    if (age > 0 && age < 72 * 3_600_000) {
      const ago = sinceLabel(age);
      out.push({
        kind: "fresh",
        lines: [
          `Submitted ${ago} ago. You got here early.`,
          `This only went up ${ago} ago.`,
          `${ago} old, and you found it.`,
        ],
      });
    }
  }

  if (n >= 2 && n <= 10) {
    out.push({
      kind: "early",
      lines: [
        `You're the ${ordinal(n)} person to keep this.`,
        n === 2
          ? "One other person had kept this. Now two."
          : `Only ${n - 1} people had kept this. Now ${n}.`,
        `That makes ${n} of you who have kept it.`,
      ],
    });
  }

  if (heardItOut) {
    out.push({
      kind: "full",
      lines: [
        "You heard it all the way out. That counts double.",
        "Full listen. Worth twice as much.",
        "You let it finish, so it counts double.",
      ],
    });
  }

  if (n >= 11 && n < 40) {
    out.push({
      kind: "middle",
      lines: [
        `${n} people have kept this now.`,
        `You're number ${n} on this one.`,
      ],
    });
  }

  // Past forty, a position stops being a discovery claim and turns into a
  // queue number, so it gives way to something about them instead.
  const total = f.savedTotal ?? 0;
  if (total > 1) {
    out.push({
      kind: "tally",
      lines: [`That's ${total} you've kept.`, `${total} saved so far.`],
    });
  }

  return out;
}

function pick(lines: string[]): string {
  const fresh = lines.filter((l) => !recentTexts.includes(l));
  const pool = fresh.length ? fresh : lines;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Returns the line to show, or null when there is nothing true worth saying.
 *
 * Never call this for a pass.
 */
export function saveMoment(facts: SaveFacts): string | null {
  const all = candidates(facts);
  if (!all.length) return null;

  // Prefer something that has not come up lately. If everything has, fall
  // back to anything other than the line shown immediately before.
  const unused = all.filter((c) => !recentKinds.includes(c.kind));
  const pool = unused.length
    ? unused
    : all.filter((c) => c.kind !== recentKinds[recentKinds.length - 1]);
  const chosen = (pool.length ? pool : all)[0];

  const text = pick(chosen.lines);
  remember(recentKinds, chosen.kind);
  remember(recentTexts, text);
  return text;
}

/** Test seam: forget what has been shown. */
export function resetSaveMoments(): void {
  recentKinds.length = 0;
  recentTexts.length = 0;
}
