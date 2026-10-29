"use client";

import { useState } from "react";
import AdminSection from "./AdminSection";

type Preview = {
  recipients: number;
  alreadySentToday?: string | null;
  unfinished?: { cursor: number; total: number; sent: number } | null;
};

type Progress = {
  total: number;
  cursor: number;
  sent: number;
  failed: number;
  done: boolean;
  skipped?: string;
};

/**
 * The share cards, to every artist at once.
 *
 * One email per artist carrying a graphic for every song they have
 * submitted, rather than one email per song. Separate from the automatic
 * first-time announcement: this one goes to everybody whether they have had
 * it before or not, which is the point of pressing it.
 *
 * Sent a batch at a time because each email draws a card first, and the
 * function behind it has about ten seconds. Closing the page stops it rather
 * than breaking it: the server remembers how far it got.
 */
export default function AdminShareBlast() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const res = await fetch("/api/admin/share-blast");
      if (!res.ok) throw new Error("Could not load the preview.");
      setPreview(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setSending(true);
    setError(null);
    setConfirming(false);
    let batches = 0;
    try {
      for (;;) {
        if (++batches > 600) throw new Error("Stopped after too many batches. Press Resume.");
        const res = await fetch("/api/admin/share-blast", { method: "POST" });
        if (!res.ok) {
          throw new Error(
            "That batch did not go through. Nothing was lost. Press Preview, then Resume to carry on."
          );
        }
        const next: Progress = await res.json();
        setProgress(next);
        if (next.done || next.skipped) break;
      }
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  const already = preview?.alreadySentToday ?? null;
  const unfinished = preview?.unfinished ?? null;
  const busyAny = busy || sending;

  const total = progress?.total || unfinished?.total || preview?.recipients || 0;
  const reached = progress?.cursor ?? unfinished?.cursor ?? 0;
  const pct = total > 0 ? Math.round((reached / total) * 100) : 0;

  return (
    <AdminSection
      title="Share cards to every artist"
      description="One email per artist with a graphic for every song they have submitted. Goes to all of them, including anyone who has had it before. Once a day."
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={load}
          disabled={busyAny}
          className="border-edge hover:border-gold rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {busy && !preview ? "Loading..." : "Preview"}
        </button>

        {preview && !already && !unfinished && !confirming && !sending && total > 0 && (
          <button
            onClick={() => setConfirming(true)}
            className="border-gold bg-gold/10 text-gold hover:bg-gold/20 rounded-xl border px-4 py-2 text-sm font-semibold transition"
          >
            Send to {preview.recipients} artists
          </button>
        )}

        {unfinished && !sending && (
          <button
            onClick={send}
            className="border-gold bg-gold/10 text-gold hover:bg-gold/20 rounded-xl border px-4 py-2 text-sm font-semibold transition"
          >
            Resume ({unfinished.total - unfinished.cursor} left)
          </button>
        )}

        {/* Two steps, because this cannot be taken back. */}
        {confirming && !sending && (
          <>
            <button
              onClick={send}
              className="border-gold bg-gold/20 text-gold rounded-xl border px-4 py-2 text-sm font-semibold transition"
            >
              Yes, send to {preview?.recipients ?? 0}
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

      {/* Progress, under the button. This one takes several minutes because
          every email draws a graphic first, so a button that just sits there
          would look broken. */}
      {(sending || (progress && !progress.skipped)) && total > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <strong className="text-gold tabular-nums">{progress?.sent ?? 0}</strong>
              <span className="text-muted"> of {total} artists emailed</span>
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
              ? "Drawing a graphic for each one, so this takes several minutes. Leave this page open. If you close it, Preview will offer to resume."
              : progress?.done
                ? "Finished."
                : "Stopped partway. Press Preview, then Resume."}
          </p>
        </div>
      )}

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}

      {progress?.skipped && <p className="text-muted mt-3 text-sm">{progress.skipped}</p>}

      {already && (
        <p className="text-muted mt-3 text-sm">
          Already sent today at {already}. One mass send a day, so the next can go out tomorrow.
        </p>
      )}

      {unfinished && (
        <p className="text-muted mt-3 text-sm">
          A send today stopped after {unfinished.sent} of {unfinished.total}. Resuming picks up at
          the next artist, so nobody gets it twice.
        </p>
      )}

      {preview && !already && !unfinished && total === 0 && (
        <p className="text-muted mt-3 text-sm">
          No artist has music in the feed, so there is nothing to send.
        </p>
      )}
    </AdminSection>
  );
}
