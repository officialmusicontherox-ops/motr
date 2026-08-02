import Stripe from "stripe";

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export const stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY as string);

if (process.env.NODE_ENV !== "production") {
  globalForStripe.stripe = stripe;
}

// The artist-facing fee amount lives on the Stripe Product's active Price,
// not hardcoded here — this looks it up so it always matches whatever is
// configured in the Stripe dashboard.
export async function getArtistFeePrice(): Promise<{ id: string; unitAmount: number; currency: string }> {
  const productId = process.env.STRIPE_ARTIST_FEE_PRODUCT_ID;
  if (!productId) {
    throw new Error("STRIPE_ARTIST_FEE_PRODUCT_ID is not set");
  }

  const prices = await stripe.prices.list({ product: productId, active: true, limit: 1 });
  const price = prices.data[0];
  if (!price || price.unit_amount == null) {
    throw new Error(`No active price found for Stripe product ${productId}`);
  }

  return { id: price.id, unitAmount: price.unit_amount, currency: price.currency };
}
