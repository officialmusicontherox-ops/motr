"use client";

import { useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import { Crown, Check, Share } from "./icons";
import type { Fan } from "@/lib/types";

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
      .then(setData)
      .catch(() => setData(null));
  }, [fan.id]);

  const earned = data?.badges.filter((b) => b.earned) ?? [];
  const locked = data?.badges.filter((b) => !b.earned) ?? [];

  /**
   * Shares the rendered card as a file where the device supports it, and
   * falls back to the link. The blob is fetched before the share call rather
   * than inside it: awaiting a fetch in the handler loses the user gesture on
   * iOS and the sheet never opens.
   */
  async function share() {
    const url = `${window.location.origin}/api/achievement-card/${fan.id}?v=1`;
    const text = `${earned.length} ${earned.length === 1 ? "badge" : "badges"} earned on MOTR. Find new artists, thirty seconds at a time.`;
    const page = "https://app.musicontherox.com";
    try {
      const blob = await fetch(url).then((r) => (r.ok ? r.blob() : null));
      const file = blob ? new File([blob], "motr-badges.png", { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: "MOTR" });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text, url: page, title: "MOTR" });
        return;
      }
      await navigator.clipboard?.writeText(`${text} ${page}`);
      setShared("copied");
      window.setTimeout(() => setShared(null), 1800);
    } catch {
      // Cancelling the sheet lands here too, which is not a failure.
    }
  }

  return (
    <MotrShell>
      <div className="w-full max-w-sm md:max-w-2xl">
        <h1 className="font-display text-3xl uppercase tracking-wide">Badges</h1>
        <p className="text-muted mt-1 text-sm">
          Earned by listening, not by saving everything. They count your whole history, including
          everything from before this page existed.
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

            {earned.length > 0 && (
              <button
                onClick={share}
                className="border-gold/50 text-gold hover:bg-gold/10 mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold transition"
              >
                <Share className="h-4 w-4" />
                {shared === "copied" ? "Link copied" : "Share your badges"}
              </button>
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
