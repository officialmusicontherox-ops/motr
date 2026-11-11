/**
 * What a Spotlight costs.
 *
 * Priced to be an impulse rather than a decision. The single exists so the
 * first one is cheap enough to try without thinking; the bundles exist
 * because a Spotlight is spent mid-swipe, and stopping to pay in that moment
 * would ruin the moment it is for. Nobody buys one while a card is on screen
 * — they buy a few and then spend them the instant something lands.
 */
export const BUNDLES = [
  { id: "single", credits: 1, cents: 200, label: "1 Spotlight" },
  { id: "three", credits: 3, cents: 500, label: "3 Spotlights", note: "Most popular" },
  { id: "ten", credits: 10, cents: 1200, label: "10 Spotlights", note: "Best value" },
] as const;

export type BundleId = (typeof BUNDLES)[number]["id"];

export function bundle(id: string) {
  return BUNDLES.find((b) => b.id === id) ?? null;
}

export function price(cents: number) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}
