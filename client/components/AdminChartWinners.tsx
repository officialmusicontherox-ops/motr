"use client";

import { useEffect, useState } from "react";
import AdminSection from "./AdminSection";
import { CHART_START_LABEL } from "@/lib/weekWindow";

type Recorded = {
  id: string;
  weekStart: string;
  artistId: string | null;
  artistName: string;
  saves: number;
  writeUpUrl: string | null;
  note: string | null;
};

type Provisional = { artistName: string; saves: number; tracks: number } | null;

type Week = {
  weekStart: string;
  weekEnd: string;
  recorded: Recorded | null;
  provisional: Provisional;
};

const range = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  e.setUTCDate(e.getUTCDate() - 1);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(s)} – ${fmt(e)}`;
};

/**
 * The weekly contest: whoever's music was saved most gets a write-up on
 * Music On The Rox.
 *
 * Locking a week writes the winner down. That matters because a chart is a
 * moving window — run the same query next month and it gives a different
 * answer, so a week nobody locked is a week that quietly loses its winner.
 */
export default function AdminChartWinners() {
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState<{
    sent: number;
    total: number;
    done: boolean;
    skipped?: string;
  } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/chart-winners");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load it");
      setWeeks(data.weeks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load it");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function post(body: Record<string, unknown>, key: string): Promise<boolean> {
    setBusy(key);
    setError(null);
    const res = await fetch("/api/admin/chart-winners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "That didn't work.");
      return false;
    }
    await load();
    return true;
  }

  /**
   * Announce the winner, straight after the link is saved.
   *
   * Driven from the browser rather than the server because the mailing is
   * far longer than the ten seconds the function gets, so it has to be asked
   * for a batch at a time. The server refuses a second announcement for the
   * same week, so correcting the link later re-saves it without mailing
   * anybody twice.
   */
  async function announceWinner() {
    setAnnounce({ sent: 0, total: 0, done: false });
    for (let i = 0; i < 400; i++) {
      const res = await fetch("/api/admin/winner-announce", { method: "POST" });
      if (!res.ok) {
        setError("The link saved, but the announcement stopped. Open Winner Announcement Email to finish it.");
        setAnnounce(null);
        return;
      }
      const p = await res.json();
      setAnnounce({ sent: p.sent, total: p.total, done: p.done, skipped: p.skipped });
      if (p.done || p.skipped) return;
    }
  }

  const pending = weeks?.filter((w) => w.recorded && !w.recorded.writeUpUrl).length ?? 0;

  return (
    <AdminSection
      title="Weekly winners"
      description="Top artist each week wins a write-up on Music On The Rox. Running from October."
      defaultOpen={false}
      badge={
        pending > 0 ? (
          <span className="border-gold/40 bg-gold/10 text-gold rounded-full border px-2 py-0.5 text-xs">
            {pending} write-up{pending === 1 ? "" : "s"} to do
          </span>
        ) : undefined
      }
    >
      {error && <p className="text-nope mb-3 text-sm">{error}</p>}

      {announce && (
        <div className="border-gold/40 bg-gold/10 mb-3 rounded-xl border p-3 text-sm">
          {announce.skipped ? (
            <p className="text-muted">{announce.skipped}</p>
          ) : (
            <>
              <p>
                <strong className="text-gold tabular-nums">{announce.sent}</strong>
                <span className="text-muted">
                  {" "}
                  of {announce.total} told{announce.done ? ". Finished." : ", sending..."}
                </span>
              </p>
              <div className="border-edge bg-surface mt-1.5 h-2 overflow-hidden rounded-full border">
                <div
                  className="bg-gold h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${announce.total ? Math.round((announce.sent / announce.total) * 100) : 0}%` }}
                />
              </div>
              {!announce.done && (
                <p className="text-muted mt-1.5 text-xs">Leave this page open until it finishes.</p>
              )}
            </>
          )}
        </div>
      )}

      {!weeks && <p className="text-muted text-sm">Loading...</p>}

      {weeks && weeks.length === 0 && (
        <div className="border-edge bg-surface rounded-xl border p-4 text-sm leading-relaxed">
          <p className="text-ink font-semibold">
            Nothing to write up until {CHART_START_LABEL}.
          </p>
          <p className="text-muted mt-1">
            The chart starts that Sunday. The first week you can lock a winner for is 1 to 7
            November, and it appears here once that week has finished, on 8 November. Until then
            there is deliberately no winner to pick: a week that has not run cannot have one.
          </p>
        </div>
      )}

      {weeks && weeks.length > 0 && (
        <ul className="space-y-3">
          {weeks.map((w) => (
            <li key={w.weekStart} className="border-edge bg-surface rounded-xl border p-4">
              <p className="motr-label text-muted">{range(w.weekStart, w.weekEnd)}</p>

              {w.recorded ? (
                <>
                  <p className="mt-1 font-semibold">
                    {w.recorded.artistName}
                    <span className="text-gold font-normal">
                      {" "}
                      · {w.recorded.saves} save{w.recorded.saves === 1 ? "" : "s"}
                    </span>
                  </p>

                  {w.recorded.writeUpUrl ? (
                    <p className="mt-2 text-sm">
                      <a
                        href={w.recorded.writeUpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gold underline underline-offset-4"
                      >
                        Write-up published
                      </a>
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        value={drafts[w.recorded.id] ?? ""}
                        onChange={(e) =>
                          setDrafts({ ...drafts, [w.recorded!.id]: e.target.value })
                        }
                        placeholder="https://musicontherox.com/..."
                        className="border-edge bg-bg focus:border-gold min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition"
                      />
                      <button
                        disabled={busy === w.recorded.id || !(drafts[w.recorded.id] ?? "").trim()}
                        onClick={async () => {
                          const saved = await post(
                            {
                              action: "SET_WRITEUP",
                              winnerId: w.recorded!.id,
                              writeUpUrl: drafts[w.recorded!.id],
                            },
                            w.recorded!.id
                          );
                          if (saved) await announceWinner();
                        }}
                        className="bg-gold text-bg rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40"
                      >
                        Save link and announce
                      </button>
                    </div>
                  )}
                </>
              ) : w.provisional ? (
                <>
                  <p className="mt-1 font-semibold">
                    {w.provisional.artistName}
                    <span className="text-muted font-normal">
                      {" "}
                      · {w.provisional.saves} save{w.provisional.saves === 1 ? "" : "s"} across{" "}
                      {w.provisional.tracks} track{w.provisional.tracks === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="text-muted/70 mt-1 text-xs">
                    Not locked in yet. Recording it fixes the result, so a later recount can&apos;t
                    change who won.
                  </p>
                  <button
                    disabled={busy === w.weekStart}
                    onClick={() => post({ action: "LOCK", weekStart: w.weekStart }, w.weekStart)}
                    className="border-edge hover:border-gold hover:text-gold mt-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
                  >
                    {busy === w.weekStart ? "Locking..." : "Lock in this winner"}
                  </button>
                </>
              ) : (
                <p className="text-muted mt-1 text-sm">Nothing was saved that week.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
