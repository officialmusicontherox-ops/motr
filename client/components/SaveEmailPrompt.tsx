"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Asked once, right after a listener keeps their first song.
 *
 * The sign-in screen asks before anyone has heard anything, which is the
 * wrong moment to ask a stranger for an address. This is the right one: they
 * have just kept something and have a reason to want it kept. It never blocks
 * the next track, and a dismissal is remembered so it is genuinely asked once.
 */

const DISMISSED = "motr.savePrompt.dismissed";

export function savePromptDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}

export default function SaveEmailPrompt({
  fanId,
  savedCount,
  onClose,
}: {
  fanId: string;
  savedCount: number;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Private browsing. Asking again next session is the acceptable failure.
    }
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const res = await fetch(`/api/fans/${fanId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);

    if (res?.ok) {
      setDone(true);
      try {
        localStorage.setItem(DISMISSED, "1");
      } catch {
        // See dismiss().
      }
      setTimeout(onClose, 2200);
    } else {
      const data = await res?.json().catch(() => null);
      setError(data?.error ?? "That didn't go through. Try again in a moment.");
    }
    setPending(false);
  }

  if (done) {
    return (
      <div className="border-edge bg-surface mt-3 w-full max-w-sm shrink-0 rounded-2xl border p-4 md:max-w-2xl">
        <p className="text-sm font-semibold">Saved. Your library will keep.</p>
        <p className="text-muted mt-1 text-sm">
          We will only write about the app and the music you keep.
        </p>
      </div>
    );
  }

  return (
    <div className="border-edge bg-surface mt-3 w-full max-w-sm shrink-0 rounded-2xl border p-4 md:max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {savedCount === 1 ? "You kept your first one." : `You have kept ${savedCount}.`}
          </p>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            Leave an email and your saved tracks survive a closed tab or a new phone.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-muted hover:text-ink shrink-0 text-sm underline underline-offset-2"
        >
          Not now
        </button>
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Your email address"
          className="border-edge bg-bg focus:border-gold min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-gold text-bg shrink-0 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "..." : "Keep them"}
        </button>
      </form>

      {error && <p className="text-nope mt-2 text-sm">{error}</p>}

      {/* Consent at the point the address is handed over, same as the sign-in
          screen. The wording matches so the two cannot drift apart. */}
      <p className="text-muted mt-2 text-[0.7rem] leading-relaxed">
        You agree to our{" "}
        <Link href="/terms" className="text-gold underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-gold underline underline-offset-2">
          Privacy Policy
        </Link>
        , and to MOTR emailing you occasionally about the app and the tracks you save. Every one of
        those has an unsubscribe link, and one click stops them for good.
      </p>
    </div>
  );
}
