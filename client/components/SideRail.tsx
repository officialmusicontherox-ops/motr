"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * A desktop-only ad in the empty gutter beside the card.
 *
 * Only from 1280px up. Below that the gutter is narrower than the unit and
 * showing one would squeeze the card, which is the thing people came for.
 *
 * Kept well clear of the card rather than tucked against it. A swipe on
 * desktop is a mouse drag, and an ad sitting under where someone starts that
 * drag is a stream of accidental clicks: Google counts those as invalid
 * traffic, and enough of them costs the account rather than the placement.
 *
 * Nothing renders without a slot id, so this is safe to ship before the unit
 * exists in AdSense.
 */
export default function SideRail({
  client,
  slot,
  side,
}: {
  client?: string;
  slot?: string;
  side: "left" | "right";
}) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!client || !slot) return;
    // Strict mode mounts twice in development; pushing the same slot twice
    // makes AdSense log "already have ads in them" and render nothing.
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // A blocked or failed ad must never break the page.
    }
  }, [client, slot]);

  if (!client || !slot) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={`pointer-events-auto fixed top-1/2 z-10 hidden -translate-y-1/2 xl:block ${
        side === "left" ? "left-6 2xl:left-10" : "right-6 2xl:right-10"
      }`}
    >
      {/* 160 wide from 1280px, 300 from 1536px. The gutter beside the card is
          around 600px on a normal desktop, so the wider unit fits with room
          to spare and is worth appreciably more than a skyscraper. One
          responsive unit rather than two fixed ones, so the page makes a
          single ad request either way. */}
      <div className="border-edge bg-surface w-40 overflow-hidden rounded-xl border 2xl:w-[300px]">
        <p className="motr-label text-muted/70 px-2 pb-1 pt-1.5 text-center text-[0.6rem]">
          Sponsored
        </p>
        <ins
          className="adsbygoogle block"
          style={{ display: "block", width: "100%", height: 600 }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="vertical"
          data-full-width-responsive="false"
        />
      </div>
    </aside>
  );
}
