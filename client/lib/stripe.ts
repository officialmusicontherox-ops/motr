import Stripe from "stripe";

/**
 * Stripe, or null when no key is configured.
 *
 * Null rather than a throw at import time: without this the whole app fails
 * to boot on a deploy where the key has not been set yet, and the only
 * things that need Stripe are the two routes that check for it.
 */
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
