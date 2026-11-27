/**
 * What a Spotlight costs.
 *
 * Priced to be an impulse rather than a decision. The single exists so the
 * first one is cheap enough to try without thinking; the bundles exist
 * because a Spotlight is spent mid-swipe, and stopping to pay in that moment
 * would ruin the moment it is for. Nobody buys one while a card is on screen
 * — they buy a few and then spend them the instant something lands.
 */
/** Tiles on the Spotlight tab. */
export const SLOTS = 10;

/**
 * How long a bought Spotlight runs.
 *
 * Three days, not seven. Six slots at seven days needs six sales a week
 * just to turn over, and the moment sales outpace that every buyer is
 * waiting over a week for a slot they already paid for. Three days gives
 * the queue more than twice the throughput for the same six tiles.
 */
export const SPOTLIGHT_DAYS = 3;

/**
 * Most tiles one artist can hold at once.
 *
 * One. At two, three artists filled all six tiles and there was no room
 * for anybody else to be seen. Every tile is now a different artist, and a
 * further Spotlight for the same artist waits its turn with its full time.
 */
export const PER_ARTIST = 1;

/** The cap in words, so the copy reads right whatever the number is. */
export const CAP_PLACES = PER_ARTIST === 1 ? "1 place" : `${PER_ARTIST} places`;

/** The duration in words, so no screen can disagree with the constant. */
export const SPOTLIGHT_SPAN = `${SPOTLIGHT_DAYS} days`;

export const BUNDLES = [
  { id: "single", credits: 1, cents: 300, label: "1 Spotlight" },
  { id: "three", credits: 3, cents: 700, label: "3 Spotlights", note: "Most popular" },
  { id: "ten", credits: 10, cents: 1800, label: "10 Spotlights", note: "Best value" },
] as const;

export type BundleId = (typeof BUNDLES)[number]["id"];

export function bundle(id: string) {
  return BUNDLES.find((b) => b.id === id) ?? null;
}

export function price(cents: number) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/**
 * Black Friday weekend: half price on the bundles, from Thursday 26
 * November to the end of Sunday 29 November 2026, midnight Central. The
 * single stays at full price.
 *
 * It replaced the Thanksgiving bonus Spotlights (an extra 1 or 3 free),
 * which were not moving bundles. A lower price is the simpler offer.
 *
 * Ends by itself at that moment; nothing needs switching off.
 */
export const SALE = {
  name: "Black Friday weekend",
  ends: new Date("2026-11-30T06:00:00Z"),
  endsLabel: "Sunday, November 29",
  /** Percent off, by bundle. Anything not listed is full price. */
  percentOff: { three: 50, ten: 50 } as Record<string, number>,
};

export function saleOn(at: Date = new Date()): boolean {
  return at.getTime() < SALE.ends.getTime();
}

/** Percent off a bundle right now, or 0. */
export function percentOffFor(id: string, at: Date = new Date()): number {
  return saleOn(at) ? (SALE.percentOff[id] ?? 0) : 0;
}

/** What a bundle costs right now, in cents. The checkout charges exactly this. */
export function centsNow(id: string, at: Date = new Date()): number {
  const b = BUNDLES.find((x) => x.id === id);
  if (!b) return 0;
  return Math.round((b.cents * (100 - percentOffFor(id, at))) / 100);
}
