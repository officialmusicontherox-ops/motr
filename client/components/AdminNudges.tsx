"use client";

import { useState } from "react";
import AdminSection from "./AdminSection";

type Result = { eligible: number; sent: number; failed: number; skipped: string[] };

/**
 * The weekly come-back email, and a way to fire it by hand.
 *
 * The schedule does the work, but a recurring email that goes out unseen is
 * how a list gets burned. Running it here shows exactly who it reached before
 * the schedule is trusted with it.
 */
export default function AdminNudges() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/cron/weekly-nudge", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not run it");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminSection
      title="Come-back emails"
      description="Sent when you press the button, to listeners who swiped and then stopped. Nobody gets one twice in six days, and it stops after three unanswered."
      defaultOpen={false}
    >
      <p className="text-sm text-muted">
        Nothing is scheduled — this only sends when you press it. Goes to signed-in listeners
        with no swipe in the last 7 days. It names the tracks they
        saved and how those are doing, and carries an unsubscribe link. Anonymous listeners are
        never included — they have no address, by their own choice.
      </p>

      <button
        onClick={run}
        disabled={busy}
        className="mt-4 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-bg disabled:opacity-40"
      >
        {busy ? "Sending..." : "Send them now"}
      </button>

      {error && <p className="mt-3 text-sm text-nope">{error}</p>}

      {result && (
        <div className="mt-4 rounded-xl border border-edge bg-surface p-4 text-sm">
          <p>
            <span className="text-gold font-semibold">{result.sent}</span> sent
            {result.eligible !== result.sent && (
              <span className="text-muted"> of {result.eligible} due</span>
            )}
            {result.failed > 0 && <span className="text-nope"> · {result.failed} failed</span>}
          </p>
          {result.eligible === 0 && (
            <p className="mt-1 text-xs text-muted">
              Nobody was due — everyone with an address has either swiped this week, already had
              their three, or opted out.
            </p>
          )}
          {result.skipped.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {result.skipped.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AdminSection>
  );
}
