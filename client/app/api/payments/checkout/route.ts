import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getArtistFeePrice, stripe } from "@/lib/stripe";

// Creates an *embedded* Checkout session so the artist pays without ever
// leaving the app (ui_mode: "embedded" returns a client_secret we mount in
// an iframe, rather than redirecting to a Stripe-hosted page).
export async function POST(req: NextRequest) {
  const { trackId } = await req.json();
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  const track = await prisma.track.findUnique({
    where: { id: trackId },
    include: { artist: true },
  });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (track.feeStatus !== "PENDING") {
    return NextResponse.json(
      { error: `Track is not awaiting payment (feeStatus: ${track.feeStatus})` },
      { status: 409 }
    );
  }

  // Never take the fee when there's nobody to spend it on. The fee buys
  // consideration by curators; with none available the artist would pay for
  // a queue that doesn't exist, and we'd owe a refund. Routing falls back to
  // the wider pool when a genre is thin, so the pool as a whole is the test.
  const activeCurators = await prisma.user.count({ where: { status: "ACTIVE" } });

  if (activeCurators === 0) {
    return NextResponse.json(
      {
        error:
          "We're onboarding curators right now, so submissions are paused for a few days. " +
          "Your track keeps its spot — we'll email you the moment it reopens.",
        code: "no_curators",
      },
      { status: 409 }
    );
  }

  const price = await getArtistFeePrice();
  const origin = req.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "payment",
    line_items: [{ price: price.id, quantity: 1 }],
    client_reference_id: trackId,
    metadata: { trackId },
    return_url: `${origin}/submit/${trackId}?session_id={CHECKOUT_SESSION_ID}`,
    ...(track.artist?.email ? { customer_email: track.artist.email } : {}),
  });

  await prisma.payment.upsert({
    where: { trackId },
    update: { stripeCheckoutSessionId: session.id, amountCents: price.unitAmount, currency: price.currency },
    create: {
      trackId,
      artistId: track.artistId!,
      stripeCheckoutSessionId: session.id,
      amountCents: price.unitAmount,
      currency: price.currency,
    },
  });

  return NextResponse.json({ clientSecret: session.client_secret });
}
