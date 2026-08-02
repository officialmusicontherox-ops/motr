"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Crown } from "./icons";
import type { Fan } from "@/lib/types";

const STORAGE_KEY = "md_fan_id";

const AUTH_ERRORS: Record<string, string> = {
  bad_state: "That sign-in link expired. Try again.",
  token_exchange_failed: "Spotify wouldn't complete the sign-in. Try again.",
  profile_fetch_failed: "Couldn't read your Spotify profile. Try again.",
  server_not_configured: "Spotify sign-in isn't configured yet.",
  access_denied: "You cancelled the Spotify sign-in.",
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

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

    const savedId = fromSpotify ?? localStorage.getItem(STORAGE_KEY);
    if (!savedId) {
      setChecked(true);
      return;
    }

    fetch(`/api/fans/${savedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.fan) setFan(data.fan);
        else localStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setChecked(true));
  }, []);

  async function swipeAnonymously() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/fans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anonymous: true }),
    });
    const data = await res.json();
    setPending(false);

    if (!res.ok) {
      setError(data.error ?? "Could not start listening");
      return;
    }
    localStorage.setItem(STORAGE_KEY, data.fan.id);
    setFan(data.fan);
  }

  if (fan) return <>{children(fan)}</>;

  if (!checked) {
    return (
      <div className="bg-bg flex min-h-screen flex-1 items-center justify-center">
        <Crown className="text-gold/30 h-10 w-10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-bg relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12 text-center">
      <div
        aria-hidden
        className="bg-gold/10 pointer-events-none absolute -top-24 h-72 w-72 rounded-full blur-3xl"
      />

      <Image
        src="/motr-logo.png"
        alt="MOTR"
        width={325}
        height={145}
        priority
        className="relative h-20 w-auto"
      />
      <p className="motr-label mt-1">
        Based on <span className="text-gold">musicontherox.com</span>
      </p>

      <h1 className="font-display relative mt-10 max-w-md text-4xl uppercase leading-[1.05] tracking-wide">
        Find your next
        <span className="text-gold"> favorite song</span>
      </h1>
      <p className="text-muted relative mt-3 max-w-sm text-sm leading-relaxed">
        Thirty seconds each. Swipe what moves you. No labels, no payola — the tracks fans push
        hardest go straight to real curators.
      </p>

      {signedOut && (
        <p className="border-gold/40 bg-surface text-muted relative mt-6 rounded-xl border px-4 py-2.5 text-sm">
          You&apos;re signed out. Sign back in below.
        </p>
      )}

      <div className="relative mt-8 flex w-full max-w-xs flex-col gap-3">
        <a
          href="/api/auth/spotify/login"
          className="bg-hot text-bg flex items-center justify-center gap-2.5 rounded-full px-5 py-3.5 font-bold transition hover:brightness-110"
        >
          <SpotifyMark className="h-5 w-5" />
          Continue with Spotify
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
        Signing in with Spotify keeps your saves across devices and lets you send them to a
        playlist.
      </p>

      {error && <p className="text-nope relative mt-4 text-sm">{error}</p>}

      <div className="relative mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2">
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

function SpotifyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.8.8 0 0 1-1.1.3c-3-1.9-6.8-2.3-11.3-1.3a.8.8 0 1 1-.3-1.5c4.9-1.1 9.1-.6 12.4 1.4.4.2.5.7.3 1.1Zm1.2-2.8a1 1 0 0 1-1.3.3c-3.4-2.1-8.6-2.7-12.6-1.5a1 1 0 0 1-.6-1.9c4.6-1.4 10.3-.7 14.2 1.7.5.3.6.9.3 1.4Zm.1-2.9C14 8.4 7.7 8.2 4.2 9.2a1.2 1.2 0 1 1-.7-2.3C7.6 5.7 14.5 6 19 8.6a1.2 1.2 0 0 1-1.2 2.1Z" />
    </svg>
  );
}
