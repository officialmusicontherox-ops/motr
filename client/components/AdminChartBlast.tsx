"use client";

import { useState } from "react";
import AdminSection from "./AdminSection";

type Preview = {
  recipients: number;
  weekLabel: string;
  /** Set when one already went out today, so the button says so up front. */
  alreadySentToday?: string | null;
  songs: { title: string; artistName: string }[];
  artists: { name: string }[];
};

type Result = {
  recipients: number;
  sent: number;
  failed: number;
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
 */
export default function AdminChartBlast() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    setResult(null);
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
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chart-blast", { method: "POST" });
      if (!res.ok) throw new Error("The send failed.");
      setResult(await res.json());
      setPreview(null);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const empty = preview !== null && preview.songs.length === 0 && preview.artists.length === 0;
  const already = preview?.alreadySentToday ?? null;

  return (
    <AdminSection
      title="This week's charts"
      description="Send the current week's top ten songs and artists to every listener and artist with an address. Can be sent at any point in the week, once a day."
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={load}
          disabled={busy}
          className="border-edge hover:border-gold rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {busy && !preview ? "Loading..." : "Preview"}
        </button>

        {preview && !empty && !already && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="border-gold bg-gold/10 text-gold hover:bg-gold/20 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
          >
            Send to {preview.recipients}
          </button>
        )}

        {/* Two steps, because this cannot be taken back. */}
        {confirming && (
          <>
            <button
              onClick={send}
              disabled={busy}
              className="border-gold bg-gold/20 text-gold rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              {busy ? "Sending..." : `Yes, send to ${preview?.recipients ?? 0}`}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="border-edge text-muted hover:text-ink rounded-xl border px-4 py-2 text-sm transition"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}

      {already && (
        <p className="text-muted mt-3 text-sm">
          Already sent today at {already}. One batch a day, so the next can go out tomorrow.
        </p>
      )}

      {empty && (
        <p className="text-muted mt-3 text-sm">
          Nothing has been played this week yet, so there is no chart to send.
        </p>
      )}

      {preview && !empty && (
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

      {result && (
        <p className="mt-3 text-sm">
          {result.skipped ? (
            <span className="text-muted">{result.skipped}</span>
          ) : (
            <>
              Sent <strong>{result.sent}</strong> of {result.recipients} for {result.weekLabel}
              {result.failed > 0 && <span className="text-nope"> · {result.failed} failed</span>}
            </>
          )}
        </p>
      )}
    </AdminSection>
  );
}
