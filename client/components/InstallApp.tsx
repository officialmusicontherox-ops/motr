"use client";

import { useEffect, useState } from "react";
import { Crown, Cross } from "./icons";

/**
 * Chrome/Edge/Android fire this instead of showing their own install bar,
 * handing us the prompt to trigger whenever we choose. It isn't in the DOM
 * lib's types, so it's declared here.
 */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "motr:install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own flag, which predates the standard media query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Samsung Internet, which is the default browser on Galaxy phones.
 *
 * It supports the install prompt, but instead of handing off to Google's
 * packaging service the way Chrome does, it builds its own APK around the
 * site — and that wrapper targets an old Android SDK. Android 14 and 15
 * refuse to install anything that dated, so Play Protect throws up "Unsafe
 * app blocked: this app was built for an older version of Android".
 *
 * Nothing served from here changes that: the targetSdkVersion belongs to
 * Samsung's browser, not to the site being installed. All we can do is say
 * so before someone meets a security warning about our app.
 */
function isSamsungInternet() {
  if (typeof navigator === "undefined") return false;
  return /SamsungBrowser/i.test(navigator.userAgent);
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Offers to install MOTR to the home screen or dock. There is no app store
 * build — this is the "download the app" path, and it's the same codebase
 * either way.
 *
 * Renders nothing when it can't help: already installed, dismissed before,
 * or a browser with no install support and no iOS instructions to give.
 */
export default function InstallApp({ variant = "banner" }: { variant?: "banner" | "inline" }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [samsung, setSamsung] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    if (variant === "banner" && localStorage.getItem(DISMISSED_KEY)) return;

    // Offer guidance rather than a button that ends in a Play Protect
    // warning about our own app.
    if (isSamsungInternet()) {
      setSamsung(true);
      setEligible(true);
      setHidden(false);
      return;
    }

    // iOS has no install API at all — the only route is Share → Add to Home
    // Screen, so we show instructions rather than a button that can't work.
    if (isIos()) {
      setEligible(true);
      setHidden(false);
      return;
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      setEligible(true);
      setHidden(false);
    }
    function onInstalled() {
      setHidden(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [variant]);

  async function install() {
    if (!deferred) {
      setShowIosHelp(true);
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setHidden(true);
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setHidden(true);
  }

  if (!eligible || hidden) return null;

  const iosOnly = !deferred;

  if (variant === "inline") {
    return (
      <div className="border-gold/30 bg-surface rounded-2xl border p-4">
        <p className="flex items-center gap-2 font-semibold">
          <Crown className="text-gold h-4 w-4" />
          Install MOTR
        </p>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          {samsung
            ? "On Samsung Internet, Android blocks the install and calls it unsafe — that's Samsung's installer being out of date, not MOTR. Open app.musicontherox.com in Chrome and install from there."
            : iosOnly
              ? "Tap the Share button, then “Add to Home Screen”. MOTR opens like an app — no App Store needed."
              : "Add MOTR to your home screen or dock. Opens in its own window, no browser bars."}
        </p>
        {!iosOnly && !samsung && (
          <button
            onClick={install}
            className="bg-gold text-bg mt-3 rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wide transition hover:brightness-110"
          >
            Install app
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[4.6rem] z-40 flex justify-center px-4 md:bottom-6">
      <div className="border-gold/40 bg-surface flex w-full max-w-md items-center gap-3 rounded-2xl border p-3 shadow-2xl">
        <Crown className="text-gold h-6 w-6 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {samsung ? "Install MOTR from Chrome" : "Get MOTR on your home screen"}
          </p>
          <p className="text-muted mt-0.5 text-xs leading-snug">
            {samsung
              ? "Samsung Internet's installer is out of date, so Android blocks it. Open this page in Chrome instead."
              : showIosHelp || iosOnly
                ? "Tap Share, then “Add to Home Screen”."
                : "Installs in a second. No app store, no download."}
          </p>
        </div>

        {!iosOnly && !samsung && (
          <button
            onClick={install}
            className="bg-gold text-bg shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide"
          >
            Install
          </button>
        )}

        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted hover:text-white shrink-0 p-1 transition"
        >
          <Cross className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
