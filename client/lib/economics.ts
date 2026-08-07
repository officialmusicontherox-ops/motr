/**
 * The numbers the business runs on, in one place, with no dependencies.
 *
 * Deliberately separate from payouts.ts: that module talks to the database,
 * and the welcome email needs these figures without dragging a Postgres
 * driver in behind them. Anything that only needs to *state* the terms —
 * emails, marketing copy, the FAQ — imports this. Anything that moves money
 * imports payouts.ts, which re-exports all of it.
 */

/** Flat fee a curator earns per verified share (playlist placement or article). */
export const FEATURE_FEE_CENTS = 200; // $2.00

/**
 * How long a placement must stay up before it counts. Applies to playlist
 * adds and video posts — both can be pulled the moment they're submitted.
 * A published article is treated as durable and clears immediately.
 */
export const SHARE_HOLD_DAYS = 4;

/** Share types that have to survive the hold period. */
export const HELD_SHARE_TYPES = ["PLAYLIST", "VIDEO"] as const;

/**
 * Holding period before earned money can be cashed out. Covers the
 * chargeback/refund window and Stripe's fund-availability delay, so we never
 * pay out money that can still be clawed back.
 */
export const PAYOUT_MATURITY_DAYS = 7;

/** Minimum balance before a curator can request a cashout — transfer fees make anything smaller uneconomic. */
export const MIN_WITHDRAWAL_CENTS = 5000; // $50.00

/**
 * Flat fee deducted from each cashout to cover the transfer cost, matching
 * how Groover handles it. Disclosed on the earnings screen before a curator
 * requests anything.
 */
export const WITHDRAWAL_FEE_CENTS = 200; // $2.00

/** How many curators a track is routed to once it clears the fan vote. */
export const CURATORS_PER_TRACK = 5;

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
