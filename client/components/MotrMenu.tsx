"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowOut, Note } from "./icons";
import InstallApp from "./InstallApp";

const LINKS = [
  { href: "/artists", label: "Submit your song", note: "Free. Paste a Spotify link" },
  { href: "/faq", label: "How it works", note: "Thirty seconds, no names, your call" },
  { href: "/contact", label: "Contact", note: "Questions, press, support" },
  { href: "/privacy", label: "Privacy", note: "What we collect and why" },
  { href: "/terms", label: "Terms", note: "What you agree to by using MOTR" },
];

export default function MotrMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Escape to dismiss, and don't let the page scroll behind the drawer.
  const [signingOut, setSigningOut] = useState(false);
  const [light, setLight] = useState(false);

  // Read from the document rather than from storage: the inline script in
  // layout.tsx has already applied the saved theme by now, so the DOM is the
  // one source that can't disagree with what's on screen.
  useEffect(() => {
    setLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  function toggleTheme() {
    const next = !light;
    setLight(next);
    const root = document.documentElement;
    if (next) root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem("motr_theme", next ? "light" : "dark");
    } catch {
      // A private window can refuse storage. The theme still applies for
      // this session; it just won't be remembered.
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  function signOut() {
    setSigningOut(true);
    localStorage.removeItem("md_fan_id");
    localStorage.removeItem("md_curator_id");
    // A full document load, and to a *different* URL than the one we may
    // already be on — assigning the current path can be a no-op, which made
    // signing out look like nothing happened. The flag tells the sign-in
    // screen to confirm it worked.
    window.location.href = "/?signedout=1";
  }

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        // Sized off the viewport so it can never overflow a narrow phone,
        // and capped so it doesn't stretch absurdly wide on desktop.
        className={`border-edge bg-surface fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-[20rem] flex-col overflow-x-hidden border-r transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-edge flex shrink-0 items-center justify-between gap-3 border-b px-4 py-4">
          <Image
            src="/motr-logo.png"
            alt="MOTR"
            width={1000}
            height={550}
            className="h-9 w-auto shrink-0"
          />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="text-muted hover:text-ink transition"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={onClose}
                  className="hover:bg-surface-2 group block rounded-xl px-3 py-3 transition"
                >
                  <span className="group-hover:text-gold flex items-center gap-2 font-semibold transition">
                    <Note className="text-gold/50 group-hover:text-gold h-3.5 w-3.5 transition" />
                    {l.label}
                  </span>
                  <span className="text-muted mt-0.5 block pl-[1.4rem] text-xs">{l.note}</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* In the menu rather than on the swipe screen: that screen has to
              fit a phone without scrolling, and a theme switch is something
              people set once and forget. */}
          <button
            type="button"
            onClick={toggleTheme}
            className="border-edge hover:border-gold mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-3 transition"
          >
            <span className="flex flex-col items-start">
              <span className="font-semibold">{light ? "Light mode" : "Dark mode"}</span>
              <span className="text-muted mt-0.5 text-xs">
                Tap to switch to {light ? "dark" : "light"}
              </span>
            </span>
            <span
              aria-hidden
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                light ? "bg-gold" : "bg-surface-2"
              }`}
            >
              <span
                className={`bg-bg absolute top-1 h-4 w-4 rounded-full shadow transition-all ${
                  light ? "left-6" : "left-1"
                }`}
              />
            </span>
          </button>

          {/* Renders nothing once MOTR is already installed, so the menu
              doesn't offer something that's already done. */}
          <div className="mt-4">
            <InstallApp variant="inline" />
          </div>

          <div className="border-edge mt-5 border-t pt-5">
            <a
              href="https://musicontherox.com"
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="hover:bg-surface-2 flex items-center justify-between rounded-xl px-3 py-3 transition"
            >
              <span>
                <span className="text-gold block font-semibold">MusicOnTheRox.com</span>
                <span className="text-muted mt-0.5 block text-xs">The mothership</span>
              </span>
              <ArrowOut className="text-muted h-4 w-4" />
            </a>
          </div>
        </nav>

        {/* Nothing sits in the very bottom corner — that's where the
            dev-tools indicator overlaps and swallows clicks. */}
        <div className="border-edge shrink-0 border-t px-3 py-3 pb-6">
          <button
            onClick={signOut}
            disabled={signingOut}
            className="border-edge text-muted hover:border-nope/50 hover:text-nope w-full rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>

          {/* Deliberately understated: this is a staff door in a menu fans
              and artists also use, so it shouldn't advertise what's behind
              it or compete with the real destinations above. */}
          <Link
            href="/admin"
            onClick={onClose}
            className="text-muted hover:text-gold block rounded-lg px-3 py-2 text-xs font-medium transition"
          >
            Admin
          </Link>
        </div>
      </aside>
    </>
  );
}
