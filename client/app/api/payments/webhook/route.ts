import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Stripe posts here when a checkout completes. Payment success is what
// promotes a track from the fan DISCOVERY pool into curator VETTING.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (e) {
    return NextResponse.json(
      { error: `Signature verification failed: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const trackId = session.client_reference_id ?? session.metadata?.trackId;

    if (trackId) {
      await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({
          where: { trackId },
          data: {
            status: "PAID",
            stripePaymentIntentId:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          },
        });

        // Payment doesn't put the track in front of curators by itself —
        // it queues the submission for admin review first.
        await tx.track.update({
          where: { id: trackId },
          data: { feeStatus: "PAID", reviewStatus: "PENDING" },
        });
      });
    }
  }

  return NextResponse.json({ received: true });
}
