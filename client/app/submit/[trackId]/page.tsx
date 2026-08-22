"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import { Crown } from "@/components/icons";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function SubmitPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = use(params);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  // Stripe appends ?session_id=... to the return_url once checkout finishes.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("session_id")) setPaid(true);
  }, []);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not start checkout");
      throw new Error(data.error ?? "Could not start checkout");
    }
    return data.clientSecret as string;
  }, [trackId]);

  if (paid) {
    return (
      <main className="bg-bg flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Crown className="text-gold h-12 w-12" />
        <h1 className="font-display text-3xl uppercase tracking-wide">You&apos;re in</h1>
        <p className="text-muted max-w-sm text-sm leading-relaxed">
          Your track is headed to five curators in your genre. We&apos;ll let you know how it
          does.
        </p>
      </main>
    );
  }

  return (
    <main className="bg-bg min-h-screen pb-20">
      <header className="border-edge border-b px-6 py-8 text-center">
        <Image
          src="/motr-logo.png"
          alt="MOTR"
          width={1000}
          height={550}
          className="mx-auto h-16 w-auto"
        />
        <h1 className="font-display mt-6 text-3xl uppercase tracking-wide">
          Submit to curators
        </h1>
        <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
          Fans pushed this track over the line. This puts it in front of five curators who work
          in your genre — real consideration, not a guaranteed placement.
        </p>
      </header>

      {error ? (
        <p className="border-nope/40 bg-nope/10 text-nope mx-auto mt-8 max-w-md rounded-xl border p-4 text-sm">
          {error}
        </p>
      ) : (
        <div className="mx-auto mt-8 max-w-2xl px-6">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}
    </main>
  );
}
