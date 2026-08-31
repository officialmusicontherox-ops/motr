"use client";

import { useState } from "react";
import AdminSection from "./AdminSection";

type MilestoneTrack = {
  trackId: string;
  title: string;
  rightSwipes: number;
  milestone: number;
};

type Recipient = {
  artistId: string;
  artistName: string;
  email: string;
  tracks: MilestoneTrack[];
};

type Preview = { recipients: Recipient[]; artists: number; tracks: number };
type Result = { eligible: number; sent: number; failed: number; tracksMarked: number };

/**
 * Progress emails to artists, when one of their tracks passes a round number.
 *
 * Preview first, always. This is the only thing in the dashboard that reaches
 * people who don't work here, and a send can't be taken back — so the list is
 * shown, read, and only then sent.
 */
export default function AdminArtistUpdates() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/artist-updates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the list");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/artist-updates", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setResult(data);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminSection
      title="Artist updates"
      description="Tells an artist when a track passes a round number of right swipes, and asks them to send their own fans over."
      defaultOpen={false}
      badge={
        preview && preview.artists > 0 ? (
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs text-gold">
            {preview.artists} due
          </span>
        ) : undefined
      }
    >
      <p className="text-muted text-sm">
        Milestones are 1, 10, 25, 50, 100, 250 and 500 right swipes. Every figure quoted is a
        running total, never a change since last time — so an email only ever arrives with good
        news in it, and a quiet week produces nothing at all. An artist with several tracks gets
        one email covering all of them, and each milestone is sent once.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={load}
          disabled={busy}
          className="border-edge hover:border-gold hover:text-gold rounded-full border px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40"
        >
          {busy && !preview ? "Checking..." : "Show who's due"}
        </button>

        {preview && preview.artists > 0 && (
          <button
            onClick={send}
            disabled={busy}
            className="bg-gold text-bg rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-40"
          >
            {busy ? "Sending..." : `Send to ${preview.artists} artist${preview.artists === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}

      {preview && preview.artists === 0 && (
        <p className="border-edge bg-surface text-muted mt-4 rounded-xl border p-4 text-sm">
          Nobody is due. Every artist has already been told about the milestones their tracks have
          reached, or has opted out.
        </p>
      )}

      {preview && preview.artists > 0 && (
        <ul className="mt-4 space-y-2">
          {preview.recipients.map((r) => (
            <li key={r.artistId} className="border-edge bg-surface rounded-xl border p-3">
              <p className="font-medium">{r.artistName}</p>
              <p className="text-muted truncate text-xs">{r.email}</p>
              <ul className="mt-2 space-y-1">
                {r.tracks.map((t) => (
                  <li key={t.trackId} className="text-sm">
                    <span className="text-white">{t.title}</span>
                    <span className="text-gold"> · {t.rightSwipes} right swipes</span>
                    <span className="text-muted"> (passing {t.milestone})</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {result && (
        <div className="border-edge bg-surface mt-4 rounded-xl border p-4 text-sm">
          <p>
            <span className="text-gold font-semibold">{result.sent}</span> sent
            {result.eligible !== result.sent && (
              <span className="text-muted"> of {result.eligible} due</span>
            )}
            {result.failed > 0 && <span className="text-nope"> · {result.failed} failed</span>}
          </p>
          <p className="text-muted mt-1 text-xs">
            {result.tracksMarked} milestone{result.tracksMarked === 1 ? "" : "s"} recorded, so
            nobody hears about the same one twice.
          </p>
        </div>
      )}
    </AdminSection>
  );
}
