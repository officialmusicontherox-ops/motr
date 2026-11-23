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
 * Thanksgiving week, Monday 23 November to the end of Cyber Monday,
 * 30 November 2026, midnight Central. Bonus Spotlights on the bundles, not a
 * lower price: prices were only just set, and bonus credits get banked and
 * spent over the following weeks instead of all queuing for the ten places
 * at once. The single stays at full price.
 *
 * Ends by itself at that moment; nothing needs switching off.
 */
export const SALE = {
  name: "Thanksgiving week",
  ends: new Date("2026-12-01T06:00:00Z"),
  endsLabel: "Monday, November 30",
  bonus: { three: 1, ten: 3 } as Record<string, number>,
};

export function saleOn(at: Date = new Date()): boolean {
  return at.getTime() < SALE.ends.getTime();
}

/** Free Spotlights added to a bundle right now. */
export function bonusFor(id: string, at: Date = new Date()): number {
  return saleOn(at) ? (SALE.bonus[id] ?? 0) : 0;
}
