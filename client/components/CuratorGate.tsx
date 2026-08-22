"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Crown } from "./icons";
import Equalizer from "./Equalizer";
import type { User } from "@/lib/types";

const STORAGE_KEY = "md_curator_id";

const AUTH_ERRORS: Record<string, string> = {
  account_inactive:
    "This account isn't active right now. Reply to any MOTR email and we'll take a look.",
  pending: "Your application is still being reviewed. We'll be in touch.",
  declined: "That application wasn't approved this time.",
  no_account: "No curator account for that Google address yet — apply below.",
  email_unverified: "That Google address isn't verified.",
  not_configured: "Google sign-in isn't set up yet.",
  bad_state: "That sign-in link expired. Try again.",
  token_exchange_failed: "Google wouldn't complete the sign-in. Try again.",
  access_denied: "You cancelled the Google sign-in.",
};

/**
 * Curator entry. Accounts are created by an admin approving an application,
 * so there's no self-signup here — you sign in with the email you applied
 * with, or you go apply.
 */
export default function CuratorGate({
  children,
}: {
  children: (curator: User) => React.ReactNode;
}) {
  const [curator, setCurator] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Email sign-in, for curators whose address has no Google account behind
  // it. Two of the first four were in exactly that position.
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Couldn't send that.");
      else setSentTo(data.to);
    } catch {
      setError("Network problem — try again.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const authError = params.get("auth_error");
    if (authError) {
      // Approved curators are told to sign in with the address they applied
      // with, and some won't. Naming the account they actually used turns a
      // dead end into an obvious "oh, wrong Google account".
      const tried = params.get("email");
      setError(
        authError === "no_account" && tried
          ? `${tried} isn't a curator account. If you applied with a different address, sign in with that one. If the address you applied with isn't a Google account, reply to your approval email and we'll switch it over.`
          : (AUTH_ERRORS[authError] ?? "Sign-in didn't go through. Try again.")
      );
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Returning from the Google callback with our curator id.
    const fromGoogle = params.get("curator");
    if (fromGoogle) {
      localStorage.setItem(STORAGE_KEY, fromGoogle);
      window.history.replaceState({}, "", window.location.pathname);
    }

    const savedId = fromGoogle ?? localStorage.getItem(STORAGE_KEY);
    if (!savedId) {
      setChecked(true);
      return;
    }
    fetch(`/api/users/${savedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setCurator(d.user);
        else localStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setChecked(true));
  }, []);

  if (curator) return <>{children(curator)}</>;

  if (!checked) {
    return (
      <div className="bg-bg flex h-[100dvh] items-center justify-center">
        <Equalizer className="text-gold/30 h-10 w-10 " />
      </div>
    );
  }

  return (
    <div className="bg-bg flex h-[100dvh] flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-6 text-center">
      <Link href="/" aria-label="MOTR home">
        <Image
          src="/motr-logo.png"
          alt="MOTR"
          width={1000}
          height={550}
          priority
          className="h-14 w-auto"
        />
      </Link>

      <div>
        <h1 className="font-display text-3xl uppercase tracking-wide">Curator sign in</h1>
        <p className="text-muted mx-auto mt-2 max-w-xs text-sm leading-relaxed">
          Curator accounts are created when an application is approved. Use Google, or have a
          sign-in link emailed to you — whichever your address supports.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <a
          href="/api/auth/google/login"
          className="flex items-center justify-center gap-2.5 rounded-full bg-white px-5 py-3.5 font-bold text-neutral-900 transition hover:brightness-95"
        >
          <GoogleMark className="h-5 w-5" />
          Continue with Google
        </a>
        {sentTo ? (
          <div className="border-gold/40 bg-surface rounded-2xl border p-4">
            <p className="text-sm">
              Link sent to <span className="text-gold">{sentTo}</span>.
            </p>
            <p className="text-muted mt-1 text-xs leading-relaxed">
              It works once and lasts 15 minutes. Check spam if it&apos;s not there in a minute.
            </p>
            <button
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
              className="text-muted mt-2 text-xs underline underline-offset-2"
            >
              Use a different address
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="border-edge h-px flex-1 border-t" />
              <span className="motr-label text-[0.6rem]">or</span>
              <span className="border-edge h-px flex-1 border-t" />
            </div>

            {/* No password: every curator address is approved by hand before
                it can be used, so opening the inbox is the proof. */}
            <form onSubmit={requestLink} className="flex flex-col gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="the email on your application"
                className="border-edge bg-surface focus:border-gold w-full rounded-full border px-5 py-3 text-center text-sm outline-none transition placeholder:text-neutral-600"
              />
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="border-gold/50 text-gold rounded-full border px-5 py-3 text-sm font-semibold transition hover:bg-gold hover:text-bg disabled:opacity-40"
              >
                {sending ? "Sending..." : "Email me a sign-in link"}
              </button>
            </form>
          </>
        )}

        <p className="text-muted text-xs leading-relaxed">
          Either way works. Your earnings and payout details sit behind this, so it&apos;s a real
          sign-in rather than just an address.
        </p>
      </div>

      {error && (
        <p className="border-nope/40 bg-nope/10 text-nope max-w-xs rounded-xl border p-3 text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-3">
        <Link
          href="/apply"
          className="border-edge hover:border-gold hover:text-gold rounded-full border px-5 py-2.5 text-sm font-semibold transition"
        >
          Apply to become a curator
        </Link>
        <Link href="/" className="motr-label hover:text-gold underline-offset-4 hover:underline">
          ← Back to discovering
        </Link>
      </div>
    </div>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
