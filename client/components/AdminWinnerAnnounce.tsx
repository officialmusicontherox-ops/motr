"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Preview =
  | { ready: false; reason: string; recipients: number }
  | {
      ready: true;
      artistName: string;
      weekLabel: string;
      writeUpUrl: string;
      recipients: number;
      unfinished: { cursor: number; total: number; sent: number } | null;
    };

type Progress = {
  total: number;
  cursor: number;
  sent: number;
  failed: number;
  done: boolean;
  skipped?: string;
  artistName?: string;
};

/**
 * Telling everyone who won, with the article.
 *
 * Waits for the write-up link to be pasted into Chart winners, because the
 * article is the whole point of the email. Not fired by the paste itself: a
 * paste is also how a wrong link gets corrected, and a mailing to every
 * address cannot be the side effect of fixing a typo.
 */
export default function AdminWinnerAnnounce() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const res = await fetch("/api/admin/winner-announce");
      if (!res.ok) throw new Error("Could not load the winner.");
      setPreview(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    setSending(true);
    setError(null);
    setConfirming(false);
    let batches = 0;
    try {
      for (;;) {
        if (++batches > 400) throw new Error("Stopped after too many batches. Press Resume.");
        const res = await fetch("/api/admin/winner-announce", { method: "POST" });
        if (!res.ok) {
          throw new Error("That batch did not go through. Nothing was lost. Press Preview, then send again to carry on.");
        }
        const next: Progress = await res.json();
        setProgress(next);
        if (next.done || next.skipped) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  const ready = preview?.ready === true ? preview : null;
  const unfinished = ready?.unfinished ?? null;
  const total = progress?.total || unfinished?.total || ready?.recipients || 0;
  const reached = progress?.cursor ?? unfinished?.cursor ?? 0;
  const pct = total > 0 ? Math.round((reached / total) * 100) : 0;

  return (
    <AdminSection
      title="Winner Announcement Email"
      description="Tells every listener and artist who won the week, with a button straight to your write-up. Becomes available once the week is locked and the article link is pasted into Chart winners."
      defaultOpen={false}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void load()}
          disabled={busy || sending}
          className="border-edge hover:border-gold rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {busy && !preview ? "Checking..." : "Preview"}
        </button>

        {ready && !confirming && !sending && (
          <button
            onClick={() => setConfirming(true)}
            className="border-gold bg-gold/10 text-gold hover:bg-gold/20 rounded-xl border px-4 py-2 text-sm font-semibold transition"
          >
            {unfinished
              ? `Resume (${unfinished.total - unfinished.cursor} left)`
              : `Announce ${ready.artistName} to ${ready.recipients}`}
          </button>
        )}

        {confirming && !sending && (
          <>
            <button
              onClick={send}
              className="border-gold bg-gold/20 text-gold rounded-xl border px-4 py-2 text-sm font-semibold transition"
            >
              Yes, send it
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="border-edge text-muted hover:text-ink rounded-xl border px-4 py-2 text-sm transition"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}

      {preview?.ready === false && (
        <p className="text-muted mt-3 text-sm leading-relaxed">{preview.reason}</p>
      )}

      {ready && (
        <div className="border-edge bg-surface mt-3 rounded-xl border p-4 text-sm">
          <p className="motr-label text-gold">{ready.weekLabel}</p>
          <p className="mt-1">
            <strong>{ready.artistName}</strong>
            <span className="text-muted"> wins, going to {ready.recipients} addresses</span>
          </p>
          <p className="mt-1 truncate text-xs">
            <a
              href={ready.writeUpUrl}
              target="_blank"
              rel="noopener"
              className="text-gold hover:underline"
            >
              {ready.writeUpUrl}
            </a>
          </p>
        </div>
      )}

      {(sending || (progress && !progress.skipped)) && total > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <strong className="text-gold tabular-nums">{progress?.sent ?? 0}</strong>
              <span className="text-muted"> of {total} sent</span>
              {(progress?.failed ?? 0) > 0 && (
                <span className="text-nope"> · {progress?.failed} failed</span>
              )}
            </span>
            <span className="text-muted text-xs tabular-nums">{pct}%</span>
          </div>
          <div className="border-edge bg-surface mt-1.5 h-2 overflow-hidden rounded-full border">
            <div
              className="bg-gold h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-muted mt-1.5 text-xs">
            {sending
              ? "Sending in batches. Leave this page open. If you close it, Preview will offer to resume."
              : progress?.done
                ? "Finished."
                : "Stopped partway. Press Preview, then Resume."}
          </p>
        </div>
      )}

      {progress?.skipped && <p className="text-muted mt-3 text-sm">{progress.skipped}</p>}
    </AdminSection>
  );
}
