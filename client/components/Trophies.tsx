"use client";

import { useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import { Crown, Check, Share } from "./icons";
import type { Fan } from "@/lib/types";
import { markBadgesSeen } from "@/lib/badgeNotices";

type Badge = {
  id: string;
  name: string;
  note: string;
  need: number;
  have: number;
  earned: boolean;
  /** Fraction of listeners holding it, or null when it is not derived from swipes. */
  heldBy: number | null;
};

type Payload = {
  stats: { saves: number; fullListens: number; listenMinutes: number; firstFinds: number; streak: number };
  badges: Badge[];
  next: Badge | null;
};

/** How rare a badge is, in words a listener reads rather than a raw fraction. */
function rare(held: number): string {
  const pct = held * 100;
  if (pct < 1) return "Top 1%";
  return `${Math.round(pct)}% have it`;
}

export default function Trophies({ fan }: { fan: Fan }) {
  const [data, setData] = useState<Payload | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/fans/achievements?fanId=${fan.id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        // Being on this page is what clears the dot on the tab.
        markBadgesSeen();
      })
      .catch(() => setData(null));
  }, [fan.id]);

  const earned = data?.badges.filter((b) => b.earned) ?? [];
  const locked = data?.badges.filter((b) => !b.earned) ?? [];

  /**
   * Copies the badge's link. That is the whole job.
   *
   * The link carries its own picture and wording: pasted into a post it opens
   * out into the graphic, the badge name and a line telling a stranger what
   * MOTR is. Nothing to save, attach or upload.
   */
  async function copyLink(badge: Badge) {
    const url = `${window.location.origin}/b/${fan.id}/${badge.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShared(badge.id);
      window.setTimeout(() => setShared(null), 2200);
    } catch {
      // Clipboard refused, usually an insecure context. The share sheet is
      // the next best thing, and failing that the link is on screen anyway.
      try {
        await navigator.share?.({ url, title: `Badge unlocked on MOTR: ${badge.name}` });
      } catch {
        // Cancelled, which is not a failure.
      }
    }
  }

  return (
    <MotrShell>
      <div className="w-full max-w-sm md:max-w-2xl">
        <h1 className="font-display text-3xl uppercase tracking-wide">Badges</h1>
        <p className="text-muted mt-1 text-sm">
          Earned by listening, not by saving everything. They count your whole history, including
          everything from before this page existed. Copy a badge's link and paste it anywhere: it
          opens out into its own graphic.
        </p>

        {data === null ? (
          <p className="text-muted mt-8 text-sm">Counting…</p>
        ) : (
          <>
            {/* The pull. One target with the distance on it beats a wall of
                locked boxes, which reads as a list of things you have failed
                to do. */}
            {data.next && (
              <div className="border-gold/40 bg-gold/5 mt-6 rounded-2xl border px-4 py-4">
                <p className="motr-label text-gold">Next up</p>
                <p className="mt-1 font-semibold">{data.next.name}</p>
                <p className="text-muted mt-0.5 text-sm">{data.next.note}</p>
                <div className="bg-surface-2 mt-3 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-gold h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (data.next.have / data.next.need) * 100)}%` }}
                  />
                </div>
                <p className="text-muted mt-2 text-xs tabular-nums">
                  {data.next.have} of {data.next.need}
                </p>
              </div>
            )}

            {/* Loss aversion rather than a reward for signing up: people
                protect what they have already earned far harder than they
                chase a badge for filling in a form. */}
            {!fan.hasEmail && earned.length > 0 && (
              <div className="border-edge mt-4 rounded-2xl border px-4 py-4">
                <p className="text-sm">
                  <strong>
                    {earned.length === 1 ? "This badge is" : `These ${earned.length} badges are`} saved
                    on this device only.
                  </strong>{" "}
                  <span className="text-muted">
                    Add an email and they follow you to any phone or browser you use.
                  </span>
                </p>
              </div>
            )}

            <ul className="mt-6 space-y-3">
              {earned.map((b) => (
                <li key={b.id} className="border-gold/30 bg-surface flex items-center gap-3 rounded-2xl border p-3">
                  <span className="bg-gold/15 text-gold flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <Crown className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.name}</p>
                    <p className="text-muted truncate text-sm">{b.note}</p>
                  </div>
                  {/* Each badge shares its own graphic. One image per badge,
                      because nobody posts a summary of themselves. */}
                  <button
                    onClick={() => copyLink(b)}
                    aria-label={`Copy the link for ${b.name}`}
                    title="Copy link to share"
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wider transition ${
                      shared === b.id
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-gold/40 text-gold hover:bg-gold/10"
                    }`}
                  >
                    <Share className="h-3.5 w-3.5" />
                    {shared === b.id ? "Copied" : "Copy link"}
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <Check className="text-gold h-5 w-5" />
                    {b.heldBy !== null && b.heldBy > 0 && (
                      <span className="text-muted text-[0.6rem] tabular-nums">{rare(b.heldBy)}</span>
                    )}
                  </div>
                </li>
              ))}

              {locked.map((b) => (
                <li key={b.id} className="border-edge bg-surface flex items-center gap-3 rounded-2xl border p-3 opacity-55">
                  <span className="bg-surface-2 text-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <Crown className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.name}</p>
                    <p className="text-muted truncate text-sm">{b.note}</p>
                  </div>
                  <span className="text-muted shrink-0 text-xs tabular-nums">
                    {b.have}/{b.need}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </MotrShell>
  );
}
