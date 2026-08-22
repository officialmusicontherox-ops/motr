"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Crown } from "./icons";
import Equalizer from "./Equalizer";
import type { Fan } from "@/lib/types";

const STORAGE_KEY = "md_fan_id";

const AUTH_ERRORS: Record<string, string> = {
  bad_state: "That sign-in link expired. Try again.",
  token_exchange_failed: "Spotify wouldn't complete the sign-in. Try again.",
  profile_fetch_failed: "Couldn't read your Spotify profile. Try again.",
  profile_fetch_failed_403:
    "Spotify wouldn't let us read your profile. The MOTR Spotify app is still in development mode, so only approved accounts can sign in — we're fixing it. Swipe without an account in the meantime.",
  profile_fetch_failed_401:
    "Spotify rejected the sign-in token. Try again, and if it keeps happening let us know.",
  profile_fetch_failed_429: "Spotify is rate-limiting us right now. Try again in a minute.",
  server_not_configured: "Spotify sign-in isn't configured yet.",
  access_denied: "You cancelled the sign-in.",
  not_configured: "Google sign-in isn't configured yet.",
  no_email: "Google didn't share an email address, so we couldn't sign you in.",
  email_unverified: "That Google email isn't verified yet.",
  missing_code: "Sign-in didn't complete. Try again.",
};

export default function FanGate({
  children,
}: {
  children: (fan: Fan) => React.ReactNode;
}) {
  const [fan, setFan] = useState<Fan | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [anonId, setAnonId] = useState<string | null>(null);

  /**
   * Creates the anonymous listener and drops them into the feed.
   *
   * Guarded against running twice: React re-invokes effects in development,
   * and a double call here would create two listener records for one visitor
   * — inflating the count and splitting their swipes across two accounts.
   */
  const entering = useRef(false);
  const enterAnonymously = useCallback(async () => {
    if (entering.current) return null;
    entering.current = true;
    const res = await fetch("/api/fans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anonymous: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      entering.current = false;
      throw new Error(data.error ?? "Could not start listening");
    }
    localStorage.setItem(STORAGE_KEY, data.fan.id);
    setFan(data.fan);
    return data.fan;
  }, []);

  // Start the database waking while they read the screen. Neon suspends
  // when idle and takes ~1.5s to come back, which otherwise lands on the tap.
  useEffect(() => {
    void fetch("/api/warm").catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // A shared link's track id has to outlive the URL tidying below, and
    // the Google round trip, before the feed can act on it.
    const shared = params.get("track");
    if (shared) sessionStorage.setItem("motr:sharedTrack", shared);

    // Confirms the sign-out landed, since the screen it returns to looks
    // identical to a first visit.
    if (params.get("signedout")) {
      setSignedOut(true);
      window.history.replaceState({}, "", window.location.pathname);
    }

    const authError = params.get("auth_error");
    if (authError) {
      setError(AUTH_ERRORS[authError] ?? "Sign-in didn't go through. Try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Coming back from the Spotify callback with our id.
    const fromSpotify = params.get("fan");
    if (fromSpotify) {
      localStorage.setItem(STORAGE_KEY, fromSpotify);
      window.history.replaceState({}, "", window.location.pathname);
    }

    // The callback sends fans back with ?fan= for Google too.
    const fromGoogle = params.get("fan");
    if (fromGoogle) {
      localStorage.setItem(STORAGE_KEY, fromGoogle);
      window.history.replaceState({}, "", window.location.pathname);
    }

    const savedId = fromSpotify ?? fromGoogle ?? localStorage.getItem(STORAGE_KEY);
    if (!savedId) {
      // Arriving from an artist's share link means they've already chosen to
      // listen. Making them pick an account first is friction at the worst
      // moment, and it's the artist's own fans who get lost at it. Straight
      // in as an anonymous listener; they can sign in later from the menu.
      if (shared) {
        enterAnonymously().catch(() => setChecked(true));
        return;
      }
      setChecked(true);
      return;
    }
    setAnonId(savedId);

    fetch(`/api/fans/${savedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.fan) setFan(data.fan);
        else localStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setChecked(true));
  }, [enterAnonymously]);

  async function swipeAnonymously() {
    setPending(true);
    setError(null);
    try {
      await enterAnonymously();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start listening");
    } finally {
      setPending(false);
    }
  }

  if (fan) return <>{children(fan)}</>;

  if (!checked) {
    return (
      <div className="bg-bg flex h-[100dvh] items-center justify-center">
        <Equalizer className="text-gold/30 h-10 w-10 " />
      </div>
    );
  }

  return (
    <div className="bg-bg relative flex h-[100dvh] flex-col items-center justify-center overflow-y-auto px-6 py-6 text-center">
      <div
        aria-hidden
        className="bg-gold/10 pointer-events-none absolute -top-24 h-72 w-72 rounded-full blur-3xl"
      />

      <Image
        src="/motr-logo.png"
        alt="MOTR"
        width={1000}
        height={550}
        priority
        className="relative h-16 w-auto sm:h-20"
      />
      <p className="motr-label mt-1">
        Based on <span className="text-gold">musicontherox.com</span>
      </p>

      <h1 className="font-display relative mt-6 max-w-md text-3xl uppercase leading-[1.05] tracking-wide sm:mt-8 sm:text-4xl">
        Find your next
        <span className="text-gold"> favorite song</span>
      </h1>
      <p className="text-muted relative mt-2.5 max-w-sm text-sm leading-relaxed">
        Thirty seconds each. Swipe what moves you. No labels, no payola — the tracks fans push
        hardest go straight to real curators.
      </p>

      {signedOut && (
        <p className="border-gold/40 bg-surface text-muted relative mt-6 rounded-xl border px-4 py-2.5 text-sm">
          You&apos;re signed out. Sign back in below.
        </p>
      )}

      <div className="relative mt-6 flex w-full max-w-xs flex-col gap-3">
        {/* Google leads while the Spotify app is capped at 25 hand-added
            accounts in development mode. Spotify was the top button and
            failed for every visitor who wasn't on that list — a broken first
            impression for the majority. It's offered from Saved instead,
            where someone opts into it for library saves and a failure is
            explained rather than fatal. */}
        <a
          href={`/api/auth/google/login?as=fan${anonId ? `&merge=${anonId}` : ""}`}
          className="flex items-center justify-center gap-2.5 rounded-full bg-white px-5 py-3.5 font-bold text-neutral-900 transition hover:brightness-95"
        >
          <GoogleMark className="h-5 w-5" />
          Continue with Google
        </a>

        <button
          onClick={swipeAnonymously}
          disabled={pending}
          className="border-edge hover:border-gold hover:text-gold rounded-full border px-5 py-3.5 text-sm font-semibold transition disabled:opacity-40"
        >
          {pending ? "Starting..." : "Swipe without an account"}
        </button>
      </div>

      <p className="text-muted relative mt-3 max-w-xs text-xs leading-relaxed">
        Signing in keeps your saves across devices. You can connect Spotify later to push tracks
        into your own library.
      </p>

      {/* Consent belongs at the point the address is handed over, not buried
          in a policy page. Only applies to signing in — swiping without an
          account gives us no address to email. */}
      <p className="text-muted relative mt-2 max-w-xs text-[0.7rem] leading-relaxed">
        By continuing with Google you agree to our{" "}
        <Link href="/terms" className="text-gold underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-gold underline underline-offset-2">
          Privacy Policy
        </Link>
        , and to MOTR emailing you occasionally about the app and the tracks you save. Every one
        of those has an unsubscribe link, and one click stops them for good.
      </p>

      {error && <p className="text-nope relative mt-4 text-sm">{error}</p>}

      <div className="relative mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
        <Link href="/artists" className="motr-label hover:text-gold underline-offset-4 hover:underline">
          Submit your song
        </Link>
        <Link href="/apply" className="motr-label hover:text-gold underline-offset-4 hover:underline">
          Apply to curate
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
