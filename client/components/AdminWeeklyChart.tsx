"use client";

import { useState } from "react";
import AdminSection from "./AdminSection";

type Preview = {
  recipients: number;
  songs: { title: string; artistName: string }[];
  artists: { name: string }[];
};

type Result = {
  recipients: number;
  sent: number;
  failed: number;
  skipped?: string;
  songs: number;
  artists: number;
};

/**
 * The weekly chart email.
 *
 * Promised to everyone in the announcement, so it has to actually go out. The
 * preview exists because this is the widest mailing on the platform: it
 * reaches every listener and artist with an address, and a bad one can't be
 * recalled.
 */
export default function AdminWeeklyChart() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/weekly-chart");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load it");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load it");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/weekly-chart", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send");
      setResult(data);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setBusy(false);
    }
  }

  const empty = preview && preview.songs.length === 0 && preview.artists.length === 0;

  return (
    <AdminSection
      title="Weekly chart email"
      description="This week's top artists and songs, to every listener and artist with an address."
      defaultOpen={false}
    >
      <p className="text-muted text-sm leading-relaxed">
        Send this once a week. It carries ranks only, no counts, matching the Charts tab, and it
        asks people to swipe for the artists they want higher. Anyone who has opted out is
        excluded, and someone who is both a listener and an artist gets one email rather than two.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={load}
          disabled={busy}
          className="border-edge hover:border-gold hover:text-gold rounded-full border px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40"
        >
          {busy && !preview ? "Checking..." : "Show this week's chart"}
        </button>

        {preview && !empty && (
          <button
            onClick={send}
            disabled={busy}
            className="bg-gold text-bg rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-40"
          >
            {busy ? "Sending..." : `Send to ${preview.recipients}`}
          </button>
        )}
      </div>

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}

      {empty && (
        <p className="border-edge bg-surface text-muted mt-4 rounded-xl border p-4 text-sm">
          Nothing was played this week, so there is no chart to send. Sending an empty one is how a
          list learns to ignore you, so the button stays off.
        </p>
      )}

      {preview && !empty && (
        <div className="border-edge bg-surface mt-4 grid gap-5 rounded-xl border p-4 sm:grid-cols-2">
          <div>
            <p className="motr-label text-gold mb-2">Top artists</p>
            <ol className="space-y-1 text-sm">
              {preview.artists.map((a, i) => (
                <li key={a.name}>
                  <span className="text-muted mr-2 tabular-nums">{i + 1}</span>
                  {a.name}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="motr-label text-gold mb-2">Top songs</p>
            <ol className="space-y-1 text-sm">
              {preview.songs.map((t, i) => (
                <li key={`${t.title}-${i}`} className="truncate">
                  <span className="text-muted mr-2 tabular-nums">{i + 1}</span>
                  {t.title}
                  <span className="text-muted"> · {t.artistName}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {result && (
        <div className="border-edge bg-surface mt-4 rounded-xl border p-4 text-sm">
          {result.skipped ? (
            <p className="text-muted">{result.skipped}</p>
          ) : (
            <p>
              <span className="text-gold font-semibold">{result.sent}</span> sent
              {result.failed > 0 && <span className="text-nope"> · {result.failed} failed</span>}
              <span className="text-muted">
                {" "}
                · {result.artists} artists and {result.songs} songs on the chart
              </span>
            </p>
          )}
        </div>
      )}
    </AdminSection>
  );
}
