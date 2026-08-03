"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowOut, Crown } from "./icons";
import InstallApp from "./InstallApp";

const LINKS = [
  { href: "/artists", label: "Submit your song", note: "Free — paste a Spotify link" },
  { href: "/faq", label: "How it works", note: "The path from swipe to playlist" },
  { href: "/curate", label: "Curator sign in", note: "Your queue and earnings" },
  { href: "/apply", label: "Apply to curate", note: "Get paid per share" },
  { href: "/contact", label: "Contact", note: "Questions, press, support" },
  { href: "/privacy", label: "Privacy", note: "What we collect and why" },
  { href: "/terms", label: "Terms", note: "The rules, and how refunds work" },
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
            width={325}
            height={145}
            className="h-9 w-auto shrink-0"
          />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="text-muted hover:text-white transition"
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
                    <Crown className="text-gold/50 group-hover:text-gold h-3.5 w-3.5 transition" />
                    {l.label}
                  </span>
                  <span className="text-muted mt-0.5 block pl-[1.4rem] text-xs">{l.note}</span>
                </Link>
              </li>
            ))}
          </ul>

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

          <Link
            href="/admin"
            onClick={onClose}
            className="hover:bg-surface-2 group mt-1 flex items-center justify-between rounded-xl px-3 py-3 transition"
          >
            <span>
              <span className="group-hover:text-gold flex items-center gap-2 font-semibold transition">
                <Crown className="text-gold/50 group-hover:text-gold h-3.5 w-3.5 transition" />
                Admin dashboard
              </span>
              <span className="text-muted mt-0.5 block pl-[1.4rem] text-xs">
                Stats, payouts, approvals
              </span>
            </span>
          </Link>

        </div>
      </aside>
    </>
  );
}
