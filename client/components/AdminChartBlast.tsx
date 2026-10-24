"use client";

import { useState } from "react";
import AdminSection from "./AdminSection";

type Preview = {
  recipients: number;
  weekLabel: string;
  /** Set when one already went out today, so the button says so up front. */
  alreadySentToday?: string | null;
  /** Set when a send stopped partway, so the button can offer to finish it. */
  unfinished?: { cursor: number; total: number; sent: number } | null;
  songs: { title: string; artistName: string }[];
  artists: { name: string }[];
};

type Progress = {
  total: number;
  cursor: number;
  sent: number;
  failed: number;
  done: boolean;
  skipped?: string;
  weekLabel: string;
  songs: number;
  artists: number;
};

/**
 * This week's charts, sent whenever the button is pressed.
 *
 * The preview exists because this is the widest mailing on the platform: it
 * reaches every listener and artist with an address, and a bad one cannot be
 * recalled. It shows the exact lists that would go, so what is approved is
 * what is sent.
 *
 * The send is made a batch at a time. The function behind it has about ten
 * seconds, nowhere near enough for the whole list, so this asks for one batch
 * after another and shows the count climbing. Closing the page stops it
 * rather than breaking it: the server remembers how far it got, and pressing
 * again carries on from there.
 */
export default function AdminChartBlast() {
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
      const res = await fetch("/api/admin/chart-blast");
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
    // A ceiling on the loop so a server that never reports done cannot leave
    // the browser asking forever. Ten addresses a batch, so this is far more
    // than the list will ever need.
    let batches = 0;
    try {
      for (;;) {
        if (++batches > 400) throw new Error("Stopped after too many batches. Press Resume.");
        const res = await fetch("/api/admin/chart-blast", { method: "POST" });
        if (!res.ok) {
          throw new Error(
            "That batch did not go through. Nothing was lost. Press Resume to carry on from where it stopped."
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

  const empty = preview !== null && preview.songs.length === 0 && preview.artists.length === 0;
  const already = preview?.alreadySentToday ?? null;
  const unfinished = preview?.unfinished ?? null;
  const busyAny = busy || sending;

  // What the progress line counts up to. The preview's number before the send
  // starts, the server's own once it has one, since the server is sending from
  // a list it snapshotted and that is the list that matters.
  const total = progress?.total || unfinished?.total || preview?.recipients || 0;
  const reached = progress?.cursor ?? unfinished?.cursor ?? 0;
  const pct = total > 0 ? Math.round((reached / total) * 100) : 0;

  return (
    <AdminSection
      title="This week's charts"
      description="Send the current week's top ten songs and artists to every listener and artist with an address. Can be sent at any point in the week, once a day."
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={load}
          disabled={busyAny}
          className="border-edge hover:border-gold rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {busy && !preview ? "Loading..." : "Preview"}
        </button>

        {preview && !empty && !already && !unfinished && !confirming && !sending && (
          <button
            onClick={() => setConfirming(true)}
            className="border-gold bg-gold/10 text-gold hover:bg-gold/20 rounded-xl border px-4 py-2 text-sm font-semibold transition"
          >
            Send to {preview.recipients}
          </button>
        )}

        {/* A send that stopped partway is finished, not started again: the
            addresses already reached are skipped. */}
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

      {/* Progress, under the button. A mailing this size takes a couple of
          minutes, and a button that just sits there looks broken. */}
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
            <span className="text-muted tabular-nums text-xs">{pct}%</span>
          </div>
          <div className="border-edge bg-surface mt-1.5 h-2 overflow-hidden rounded-full border">
            <div
              className="bg-gold h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-muted mt-1.5 text-xs">
            {sending
              ? "Sending in batches. Leave this page open until it finishes. If you close it, Preview will offer to resume."
              : progress?.done
                ? `Finished. ${progress.weekLabel}.`
                : "Stopped partway. Press Preview, then Resume."}
          </p>
        </div>
      )}

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}

      {progress?.skipped && <p className="text-muted mt-3 text-sm">{progress.skipped}</p>}

      {already && (
        <p className="text-muted mt-3 text-sm">
          Already sent today at {already}. One batch a day, so the next can go out tomorrow.
        </p>
      )}

      {unfinished && (
        <p className="text-muted mt-3 text-sm">
          A send today stopped after {unfinished.sent} of {unfinished.total}. Resuming picks up at
          the next address, so nobody gets it twice.
        </p>
      )}

      {empty && (
        <p className="text-muted mt-3 text-sm">
          Nothing has been played this week yet, so there is no chart to send.
        </p>
      )}

      {preview && !empty && !sending && (
        <div className="mt-4">
          <p className="motr-label text-gold">{preview.weekLabel}</p>
          <p className="text-muted mt-1 text-xs">
            Goes to {preview.recipients} {preview.recipients === 1 ? "address" : "addresses"}, with
            app.musicontherox.com below the charts.
          </p>

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <p className="motr-label text-muted mb-1.5">Top artists</p>
              <ol className="space-y-1 text-sm">
                {preview.artists.map((a, i) => (
                  <li key={a.name} className="flex gap-2">
                    <span className="text-muted w-5 tabular-nums">{i + 1}</span>
                    <span className="truncate">{a.name}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="motr-label text-muted mb-1.5">Top songs</p>
              <ol className="space-y-1 text-sm">
                {preview.songs.map((s, i) => (
                  <li key={`${s.title}-${i}`} className="flex gap-2">
                    <span className="text-muted w-5 tabular-nums">{i + 1}</span>
                    <span className="truncate">
                      {s.title} <span className="text-muted">{s.artistName}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </AdminSection>
  );
}
