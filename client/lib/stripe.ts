import Stripe from "stripe";

/**
 * Stripe, or null when no key is configured.
 *
 * Its own key, not the shared STRIPE_SECRET_KEY. That name is already set
 * on the site for the music submissions on musicontherox.com, and a key
 * with Spotlight's narrow permissions would break them. Keeping the two
 * apart also means either can be rolled without touching the other.
 *
 * Null rather than a throw at import time: without this the whole app fails
 * to boot on a deploy where the key has not been set yet, and the only
 * things that need Stripe are the two routes that check for it.
 */
export const stripe = process.env.STRIPE_SPOTLIGHT_KEY
  ? new Stripe(process.env.STRIPE_SPOTLIGHT_KEY)
  : null;
