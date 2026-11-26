"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Equalizer from "./Equalizer";
import type { Fan } from "@/lib/types";
import { safeLocal, safeSession } from "@/lib/storage";

const STORAGE_KEY = "md_fan_id";

const AUTH_ERRORS: Record<string, string> = {
  bad_state: "That sign-in link expired. Try again.",
  token_exchange_failed: "Spotify wouldn't complete the sign-in. Try again.",
  profile_fetch_failed: "Couldn't read your Spotify profile. Try again.",
  profile_fetch_failed_403:
    "Spotify wouldn't let us read your profile. The MOTR Spotify app is still in development mode, so only approved accounts can sign in. We're fixing it. Swipe without an account in the meantime.",
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
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const code = new URLSearchParams(window.location.search).get("auth_error");
    return code ? (AUTH_ERRORS[code] ?? "Sign-in didn't go through. Try again.") : null;
  });
  const [pending, setPending] = useState(false);
  // Confirms the sign-out landed, since the screen it returns to looks
  // identical to a first visit.
  const [signedOut] = useState(
    () => typeof window !== "undefined" && Boolean(new URLSearchParams(window.location.search).get("signedout"))
  );

  /** Where to come back to after signing in: this page, as they opened it. */
  // Read once from the address bar. Nothing on the first render uses them
  // (it is the loading screen until the check below finishes), so the
  // server's empty values never show.
  const [here] = useState(() => (typeof window === "undefined" ? "/" : currentPath()));
  const [invited] = useState(() => {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search);
    return Boolean(p.get("track") || p.get("b"));
  });
  const [inApp] = useState(() => (typeof navigator === "undefined" ? null : inAppBrowser(navigator.userAgent)));
  const [linkEmail, setLinkEmail] = useState("");
  const [linkSent, setLinkSent] = useState<string | null>(null);

  // Start the database waking while they read the screen. Neon suspends
  // when idle and takes ~1.5s to come back, which otherwise lands on the tap.
  useEffect(() => {
    void fetch("/api/warm").catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Only our own markers come out of the address bar. A shared song's
    // ?track= and a battle's ?b= stay, because the page behind the wall
    // reads them once the listener is signed in.
    window.history.replaceState({}, "", currentPath());

    // A shared link's track id has to outlive the URL tidying below, and
    // the Google round trip, before the feed can act on it.
    const shared = params.get("track");
    if (shared) safeSession.setItem("motr:sharedTrack", shared);



    // Both providers now say only that it worked. The id comes from the session
    // rather than the address bar, so it never lands in browser history.
    if (params.get("signedin")) {
      fetch("/api/fans/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.fan) return;
          safeLocal.setItem(STORAGE_KEY, data.fan.id);
          setFan(data.fan);
        })
        .catch(() => {})
        .finally(() => setChecked(true));
      return;
    }

    const savedId = safeLocal.getItem(STORAGE_KEY);
    if (!savedId) {
      // Nothing saved here does not mean a stranger. Where a browser has no
      // storage, or it has been cleared, the session cookie may still know
      // them.
      fetch("/api/fans/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.fan) {
            safeLocal.setItem(STORAGE_KEY, data.fan.id);
            setFan(data.fan);
          }
        })
        .catch(() => {})
        .finally(() => setChecked(true));
      return;
    }

    fetch(`/api/fans/${savedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.fan) setFan(data.fan);
        else safeLocal.removeItem(STORAGE_KEY);
      })
      .catch(() => safeLocal.removeItem(STORAGE_KEY))
      .finally(() => setChecked(true));
  }, []);

  /** Emails a one-time sign-in link, for anyone without Google. */
  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: linkEmail, next: here }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the link. Try again.");
      setLinkSent(linkEmail.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the link. Try again.");
    } finally {
      setPending(false);
    }
  }

  // The whole app is for signed-in listeners. An anonymous session from
  // before the wall goes up meets the wall too; its swipes are folded into
  // their account when they sign in.
  const signedIn = Boolean(fan && (fan.hasEmail || fan.hasSpotify));
  if (fan && signedIn) return <>{children(fan)}</>;

  if (!checked) {
    return (
      <div className="bg-bg flex h-viewport items-center justify-center">
        <Equalizer className="text-gold/30 h-10 w-10 " />
      </div>
    );
  }

  const emailBlock = linkSent ? (
    <p className="border-gold/40 bg-surface rounded-xl border px-4 py-3 text-sm leading-relaxed">
      Check your inbox. We sent a sign-in link to{" "}
      <span className="text-ink font-semibold">{linkSent}</span>. It works once, for 30 minutes.
    </p>
  ) : (
    <form onSubmit={requestLink} className="flex flex-col gap-2">
      <input
        type="email"
        required
        autoComplete="email"
        value={linkEmail}
        onChange={(e) => setLinkEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Your email address"
        className="border-edge bg-surface text-ink focus:border-gold rounded-full border px-5 py-3 text-center text-sm outline-none transition"
      />
      <button
        type="submit"
        disabled={pending || !linkEmail.includes("@")}
        className={`rounded-full px-5 py-3.5 text-sm font-semibold transition disabled:opacity-40 ${
          inApp ? "bg-gold text-bg font-bold" : "border-edge hover:border-gold hover:text-gold border"
        }`}
      >
        {pending ? "Sending..." : "Email me a sign-in link"}
      </button>
    </form>
  );

  return (
    <div className="bg-bg relative flex h-viewport flex-col items-center justify-center overflow-y-auto px-6 py-safe-6 text-center">
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

      <h1 className="font-display relative mt-6 max-w-md text-3xl uppercase leading-[1.05] tracking-wide sm:mt-8 sm:text-4xl">
        Find your next
        <span className="text-gold"> favorite song</span>
      </h1>
      <p className="text-muted relative mt-2.5 max-w-sm text-sm leading-relaxed">
        {invited
          ? "Sign in and you'll go straight to what you were sent."
          : "Thirty seconds each, with no artist name attached. Swipe what moves you, and whatever you keep turns up in Saved with the artist revealed."}
      </p>

      {signedOut && (
        <p className="border-gold/40 bg-surface text-muted relative mt-6 rounded-xl border px-4 py-2.5 text-sm">
          You&apos;re signed out. Sign back in below.
        </p>
      )}

      <div className="relative mt-6 flex w-full max-w-xs flex-col gap-3">
        {inApp ? (
          <>
            {/* Inside Instagram, TikTok and the rest, Google refuses to sign
                anyone in and shows its own error page with no way back. So
                the email link leads here, and Google is offered only once
                they are in a real browser. */}
            {emailBlock}
            <Divider label="Or use Google" />
            <a
              href={openInBrowserUrl(inApp)}
              className="flex items-center justify-center gap-2.5 rounded-full bg-white px-5 py-3.5 font-bold text-neutral-900 transition hover:brightness-95"
            >
              <GoogleMark className="h-5 w-5" />
              Open in your browser to use Google
            </a>
            <p className="text-muted text-xs leading-relaxed">
              Google sign-in doesn&apos;t work inside {inApp.app}. If nothing opens, tap the{" "}
              <span className="text-ink font-semibold">•••</span> menu and choose{" "}
              <span className="text-ink font-semibold">Open in browser</span>.
            </p>
          </>
        ) : (
          <>
            <a
              // No merge parameter: the server reads the anonymous session itself.
              href={`/api/auth/google/login?as=fan&next=${encodeURIComponent(here)}`}
              className="flex items-center justify-center gap-2.5 rounded-full bg-white px-5 py-3.5 font-bold text-neutral-900 transition hover:brightness-95"
            >
              <GoogleMark className="h-5 w-5" />
              Continue with Google
            </a>
            <Divider label="No Google account?" />
            {emailBlock}
          </>
        )}
      </div>

      <p className="text-muted relative mt-3 max-w-xs text-xs leading-relaxed">
        Free, and you only do it once on each device. Your saves follow you everywhere you sign
        in.
      </p>

      {/* Consent belongs at the point the address is handed over, not buried
          in a policy page. */}
      <p className="text-muted relative mt-2 max-w-xs text-[0.7rem] leading-relaxed">
        By signing in you agree to our{" "}
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

      {/* Artists are the other audience the platform runs on. Secondary to
          signing in, but not fine print — it was 11px muted uppercase once,
          the same styling as captions, and read as a footnote. */}
      <div className="relative mt-7 w-full max-w-xs">
        <div className="flex items-center gap-3">
          <span className="border-edge h-px flex-1 border-t" />
          <span className="motr-label text-[0.6rem]">Not here to listen?</span>
          <span className="border-edge h-px flex-1 border-t" />
        </div>

        <div className="mt-3">
          <Link
            href="/artists"
            className="border-gold/40 text-gold hover:bg-gold hover:text-bg block rounded-xl border px-3 py-2.5 text-center text-sm font-bold transition"
          >
            Submit your song
            <span className="mt-0.5 block text-[0.65rem] font-medium opacity-75">
              Free for artists
            </span>
          </Link>
          {/* Artists have their own sign-in. Without this, one landing here
              would sign up as a listener and wonder where their page went. */}
          <p className="text-muted mt-2.5 text-xs">
            Already submitted?{" "}
            <Link href="/artist" className="text-gold font-semibold underline underline-offset-2">
              Sign in to your artist page
            </Link>
          </p>
        </div>

        {/* Open without signing in, so someone deciding whether to can read
            what MOTR is first, or reach us. */}
        <p className="text-muted mt-6 flex justify-center gap-4 text-xs">
          <Link href="/faq" className="hover:text-ink underline underline-offset-2">
            How MOTR works
          </Link>
          <Link href="/contact" className="hover:text-ink underline underline-offset-2">
            Contact
          </Link>
        </p>
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

/** This page's address without our own sign-in markers, so it can be returned to. */
function currentPath(): string {
  const keep = new URLSearchParams(window.location.search);
  for (const k of ["signedin", "signedout", "auth_error"]) keep.delete(k);
  const q = keep.toString();
  return window.location.pathname + (q ? `?${q}` : "");
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="border-edge h-px flex-1 border-t" />
      <span className="motr-label text-[0.6rem]">{label}</span>
      <span className="border-edge h-px flex-1 border-t" />
    </div>
  );
}

type InApp = { app: string; android: boolean; ios: boolean };

/**
 * Whether this is an app's built-in browser, which Google refuses to sign
 * anyone in from ("Error 403: disallowed_useragent"). Each of these names
 * itself in the user agent.
 */
function inAppBrowser(ua: string): InApp | null {
  const apps: [RegExp, string][] = [
    [/Instagram/i, "Instagram"],
    [/musical_ly|Bytedance|TikTok/i, "TikTok"],
    [/Barcelona/i, "Threads"],
    [/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i, "Facebook"],
    [/Snapchat/i, "Snapchat"],
    [/Pinterest/i, "Pinterest"],
    [/LinkedInApp/i, "LinkedIn"],
    [/Twitter/i, "X"],
  ];
  const hit = apps.find(([re]) => re.test(ua));
  if (!hit) return null;
  return { app: hit[1], android: /Android/i.test(ua), ios: /iPhone|iPad|iPod/i.test(ua) };
}

/**
 * This same page, opened in the phone's real browser.
 *
 * Android hands an intent:// link to Chrome, and falls back to the plain
 * address if Chrome is missing. iOS 17 and later open x-safari-https:// in
 * Safari; on older versions it does nothing, which is what the line under
 * the button is for.
 */
function openInBrowserUrl(inApp: InApp): string {
  const url = new URL(window.location.href);
  if (inApp.android) {
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.toString())};end`;
  }
  if (inApp.ios) return `x-safari-${url.toString()}`;
  return url.toString();
}
