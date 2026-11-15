"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Preview = { weekLabel: string; battles: number; toSend: number; unreachable: number };
type Progress = { remaining: number; sent: number; failed: number; skipped: number; done: boolean };

/**
 * Tell artists their song is in a battle this week.
 *
 * A button rather than something automatic, so nothing goes out until it
 * has been looked at. It can be pressed again later in the week: only
 * artists who have not been told yet are written to, which is how a battle
 * paired on a Wednesday gets its email without anybody hearing twice.
 */
export default function AdminBattleNotice() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [totals, setTotals] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/battle-notice");
      if (!res.ok) throw new Error();
      setPreview(await res.json());
    } catch {
      setError("Could not load.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    setConfirming(false);
    setSending(true);
    setError(null);
    const sum = { sent: 0, failed: 0, skipped: 0 };
    try {
      // One batch per request, because a request here has about ten
      // seconds. Capped so a fault cannot loop for ever.
      for (let i = 0; i < 80; i++) {
        const res = await fetch("/api/admin/battle-notice", { method: "POST" });
        if (!res.ok) throw new Error();
        const p: Progress = await res.json();
        sum.sent += p.sent;
        sum.failed += p.failed;
        sum.skipped += p.skipped;
        setTotals({ ...sum });
        setLeft(p.remaining);
        if (p.done) break;
      }
    } catch {
      setError("The send stopped part way. Press the button again to carry on from where it stopped.");
    } finally {
      setSending(false);
      void load();
    }
  }

  return (
    <AdminSection
      title="Tell artists their battle is open"
      description="One email per artist with the link to their battle"
    >
      {error && <p className="text-nope mb-3 text-sm">{error}</p>}

      {!preview ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed">
            <span className="text-ink font-semibold">{preview.battles}</span> battles this week (
            {preview.weekLabel}).{" "}
            {preview.toSend > 0 ? (
              <>
                <span className="text-ink font-semibold">{preview.toSend}</span> artist
                {preview.toSend === 1 ? " has" : "s have"} not been told yet.
              </>
            ) : (
              <>Everyone in a battle has been told.</>
            )}
            {preview.unreachable > 0 && (
              <span className="text-muted">
                {" "}
                {preview.unreachable} can&apos;t be reached (opted out, or no working address) and
                will be passed over.
              </span>
            )}
          </p>
          <p className="text-muted mt-1 text-xs leading-relaxed">
            Each artist gets one email naming their song, with the link to their battle. Pressing
            this again later only writes to artists whose battle was paired since.
          </p>

          <div className="mt-4">
            {confirming ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <span>Email {preview.toSend} artist{preview.toSend === 1 ? "" : "s"} now?</span>
                <button
                  onClick={() => void send()}
                  className="bg-gold text-bg rounded-full px-4 py-1.5 text-sm font-bold"
                >
                  Yes, send
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="border-edge text-muted hover:text-ink rounded-full border px-4 py-1.5 text-sm"
                >
                  Not yet
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                disabled={sending || preview.toSend === 0}
                className="bg-gold text-bg rounded-full px-5 py-2 text-sm font-bold disabled:opacity-40"
              >
                {sending ? "Sending..." : "Send battle emails"}
              </button>
            )}
          </div>

          {totals && (
            <p className="text-muted mt-3 text-sm tabular-nums">
              {sending ? "Sending. " : "Finished. "}
              {totals.sent} sent
              {totals.failed > 0 && `, ${totals.failed} failed`}
              {totals.skipped > 0 && `, ${totals.skipped} passed over`}
              {sending && left !== null && `, ${left} to go`}
            </p>
          )}
        </>
      )}
    </AdminSection>
  );
}
