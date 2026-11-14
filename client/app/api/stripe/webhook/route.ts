import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * Stripe telling us the money landed.
 *
 * This is the only place a balance goes up. The browser is never trusted
 * with it: a success_url can be opened by hand, and crediting from it would
 * hand out free Spotlights to anyone who guessed the address.
 *
 * Idempotent by the session id, which is unique on SpotlightPurchase.
 * Stripe retries a webhook until it gets a 200, so without that a slow
 * response would credit the same purchase twice.
 */
export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const secret = process.env.STRIPE_SPOTLIGHT_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  // The raw body, not the parsed one: the signature is over the exact bytes.
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
  } catch {
    // Unsigned or tampered with. 400 rather than 500 so Stripe stops retrying.
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    // Acknowledged and ignored. Anything else we did not ask for.
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  // Only a paid session. An unpaid one can complete when the method is
  // asynchronous, and those are not Spotlights yet.
  if (session.payment_status !== "paid") return NextResponse.json({ received: true });

  const fanId = session.metadata?.fanId ?? session.client_reference_id ?? null;
  const credits = Number(session.metadata?.credits ?? 0);
  if (!fanId || !Number.isInteger(credits) || credits < 1) {
    return NextResponse.json({ received: true });
  }

  try {
    await prisma.$transaction([
      prisma.spotlightPurchase.create({
        data: {
          fanId,
          sessionId: session.id,
          credits,
          cents: session.amount_total ?? 0,
        },
      }),
      prisma.fan.update({
        where: { id: fanId },
        data: { spotlightCredits: { increment: credits } },
      }),
    ]);
  } catch (e) {
    // A duplicate session id means this one was already credited, which is
    // exactly what the unique constraint is for. Anything else is real, and
    // a non-200 makes Stripe try again rather than losing the purchase.
    const code = (e as { code?: string })?.code;
    if (code !== "P2002") throw e;
  }

  /**
   * Keep the email Stripe collected, where the listener has none.
   *
   * Most buyers are anonymous: a Fan row and a cookie, no sign-in. Their
   * Spotlights live on that cookie alone, so clearing a browser, changing
   * phone, or buying inside Snapchat's in-app browser and later opening
   * MOTR in Safari loses them with nothing to look them up by. Purchases
   * are non-refundable, so that is somebody out of pocket with no recourse.
   *
   * Stripe takes an email for the receipt regardless, and the checkout page
   * says what it is for, so this costs the buyer nothing extra.
   *
   * Never overwrites an email already on the account, and a clash with
   * another account is left alone rather than forced: the purchase has
   * already been credited by this point and must not be undone over it.
   */
  const email = session.customer_details?.email?.trim().toLowerCase();
  if (email) {
    await prisma.fan
      .updateMany({ where: { id: fanId, email: null }, data: { email } })
      .catch(() => {});
  }

  return NextResponse.json({ received: true });
}
