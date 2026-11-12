import { NextRequest, NextResponse } from "next/server";
import { getFanSession } from "@/lib/fanAuth";
import { stripe } from "@/lib/stripe";
import { SPOTLIGHT_SPAN, bundle } from "@/lib/spotlightBundles";

/**
 * Start a purchase.
 *
 * Prices are built into the session rather than kept as Products in the
 * Stripe dashboard. One fewer thing to keep in sync: the price lives in
 * lib/spotlightBundles.ts, which is also what the offer sheet renders from,
 * so the two can never disagree.
 *
 * Nothing is credited here. The balance only moves when Stripe says the
 * money landed, which is the webhook's job — a listener who closes the tab
 * mid-payment must not end up with Spotlights they did not pay for.
 */
export async function POST(req: NextRequest) {
  const fanId = await getFanSession();
  if (!fanId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!stripe) {
    return NextResponse.json({ error: "Not open yet" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const b = bundle(body?.bundle);
  if (!b) return NextResponse.json({ error: "Unknown bundle" }, { status: 400 });

  const base = process.env.APP_URL ?? "https://app.musicontherox.com";
  // Only a path from our own app, never whatever the body says. An absolute
  // URL here would turn checkout into an open redirect.
  const back =
    typeof body?.returnTo === "string" && /^\/[^/\\]/.test(body.returnTo)
      ? body.returnTo
      : "/";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: b.cents,
          product_data: {
            name: b.label,
            description:
              b.credits === 1
                ? `One Spotlight on MOTR. ${SPOTLIGHT_SPAN} on the Spotlight tab. Non-refundable.`
                : `${b.credits} Spotlights on MOTR. Each one is ${SPOTLIGHT_SPAN} on the Spotlight tab. Non-refundable.`,
          },
        },
      },
    ],
    // Both are read back in the webhook. client_reference_id is the one
    // Stripe shows in the dashboard, so a refund can be traced to a listener.
    client_reference_id: fanId,
    metadata: { fanId, bundle: b.id, credits: String(b.credits) },
    success_url: `${base}${back}${back.includes("?") ? "&" : "?"}spotlights=${b.credits}`,
    cancel_url: `${base}${back}`,
  });

  return NextResponse.json({ url: session.url });
}
