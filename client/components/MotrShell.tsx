"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import MotrMenu from "./MotrMenu";
import InstallApp from "./InstallApp";
import { Bookmark, Crown, Menu, Waveform } from "./icons";

const TABS = [
  { href: "/", label: "Discover", Icon: Crown },
  { href: "/saved", label: "Saved", Icon: Bookmark },
  { href: "/curate", label: "Curate", Icon: Waveform },
];

/**
 * App chrome: brand header, an optional clip scrubber, and a fixed bottom
 * tab bar. Content scrolls between them.
 */
export default function MotrShell({
  children,
  clip,
}: {
  children: React.ReactNode;
  clip?: { currentTime: number; duration: number } | null;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const pct = clip
    ? Math.min(100, (clip.currentTime / (clip.duration || 30)) * 100)
    : 0;

  return (
    <div className="bg-bg flex min-h-screen flex-col">
      <MotrMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <InstallApp />

      {/* Pinned: the card can be taller than the screen, and the menu button
          must never scroll out of reach. */}
      <header className="bg-bg/95 sticky top-0 z-30 flex flex-col items-center px-5 pb-2 pt-4 backdrop-blur">
        <Link href="/" aria-label="MOTR home">
          <Image
            src="/motr-logo.png"
            alt="MOTR"
            width={325}
            height={145}
            priority
            className="h-14 w-auto"
          />
        </Link>
        <p className="motr-label mt-0.5 text-[0.58rem]">
          Based on <span className="text-gold">musicontherox.com</span>
        </p>

        {/* Desktop gets a real nav row. A fixed bottom bar is a phone idiom —
            on a laptop it strands the controls at the bottom of a big screen. */}
        <nav className="border-edge mt-3 hidden w-full max-w-2xl items-center justify-center gap-1 border-t pt-2 md:flex">
          {TABS.map(({ href, label, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.15em] transition ${
                  active ? "bg-surface-2 text-gold" : "text-muted hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.15em] transition ${
              menuOpen ? "bg-surface-2 text-gold" : "text-muted hover:text-white"
            }`}
          >
            <Menu className="h-4 w-4" />
            Menu
          </button>
        </nav>

        {clip && (
          <div className="mt-3 w-full max-w-sm">
            <p className="motr-label text-center">Listening to clip</p>
            <p className="mt-1 text-center text-sm tabular-nums">
              <span className="text-gold font-semibold">{fmt(clip.currentTime)}</span>
              <span className="text-muted"> / {fmt(clip.duration || 30)}</span>
            </p>
            <div className="bg-surface-2 relative mt-2 h-1 w-full rounded-full">
              <div
                className="bg-gold h-1 rounded-full"
                style={{ width: `${pct}%`, transition: "width 200ms linear" }}
              />
              <span
                className="bg-gold absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow"
                style={{ left: `${pct}%`, transition: "left 200ms linear" }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Bottom padding clears the fixed tab bar so actions never sit under it. */}
      <main className="flex flex-1 flex-col items-center px-5 pb-36 pt-4 md:px-8 md:pb-16">{children}</main>

      <nav className="border-edge bg-bg/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-md">
          {TABS.map(({ href, label, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1.5 py-3 text-[0.62rem] font-semibold uppercase tracking-[0.15em] transition ${
                    active ? "text-gold" : "text-muted hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                  <span
                    className={`bg-gold h-0.5 w-6 rounded-full transition-opacity ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </Link>
              </li>
            );
          })}

          {/* Sits with the other destinations rather than off on its own. */}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className={`flex w-full flex-col items-center gap-1.5 py-3 text-[0.62rem] font-semibold uppercase tracking-[0.15em] transition ${
                menuOpen ? "text-gold" : "text-muted hover:text-white"
              }`}
            >
              <Menu className="h-[18px] w-[18px]" />
              Menu
              <span
                className={`bg-gold h-0.5 w-6 rounded-full transition-opacity ${
                  menuOpen ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
