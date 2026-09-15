"use client";

import { useState } from "react";
import AdminSection from "./AdminSection";

type Candidate = {
  artistId: string;
  name: string;
  email: string;
  tracks: number;
  saves: number;
  lastSubmittedAt: string | null;
  nudgeCount: number;
};

type Preview = { eligible: number; artists: Candidate[] };
type Result = { eligible: number; sent: number; failed: number };

/**
 * "Send us more music" — the come-back email for artists.
 *
 * Preview first. An artist who feels chased stops submitting anywhere near
 * you, so it's worth seeing who it would reach before it goes.
 */
export default function AdminArtistNudges() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/artist-nudges");
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
      const res = await fetch("/api/admin/artist-nudges", { method: "POST" });
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

  return (
    <AdminSection
      title="Ask artists for more music"
      description="Goes to artists who haven't submitted in a while, leading with how their existing tracks are doing."
      defaultOpen={false}
      badge={
        preview && preview.eligible > 0 ? (
          <span className="border-gold/40 bg-gold/10 text-gold rounded-full border px-2 py-0.5 text-xs">
            {preview.eligible} due
          </span>
        ) : undefined
      }
    >
      <p className="text-muted text-sm leading-relaxed">
        Excluded automatically: anyone who submitted in the last 30 days, anyone emailed in the
        last 21, anyone who has ignored three, and anyone who opted out. Submitting again resets
        their count, so an artist who comes back starts fresh.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={load}
          disabled={busy}
          className="border-edge hover:border-gold hover:text-gold rounded-full border px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40"
        >
          {busy && !preview ? "Checking..." : "Show who's due"}
        </button>

        {preview && preview.eligible > 0 && (
          <button
            onClick={send}
            disabled={busy}
            className="bg-gold text-bg rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-40"
          >
            {busy ? "Sending..." : `Send to ${preview.eligible}`}
          </button>
        )}
      </div>

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}

      {preview && preview.eligible === 0 && (
        <p className="border-edge bg-surface text-muted mt-4 rounded-xl border p-4 text-sm">
          Nobody is due. Everyone has either submitted recently, been emailed recently, had their
          three, or opted out.
        </p>
      )}

      {preview && preview.eligible > 0 && (
        <ul className="mt-4 space-y-2">
          {preview.artists.map((a) => (
            <li
              key={a.artistId}
              className="border-edge bg-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{a.name}</p>
                <p className="text-muted truncate text-xs">{a.email}</p>
              </div>
              <p className="text-muted shrink-0 text-xs">
                <span className="text-gold font-semibold">{a.saves}</span> saves across {a.tracks}{" "}
                track{a.tracks === 1 ? "" : "s"}
                {a.lastSubmittedAt && (
                  <> · last submitted {new Date(a.lastSubmittedAt).toLocaleDateString()}</>
                )}
                {a.nudgeCount > 0 && <> · asked {a.nudgeCount}×</>}
              </p>
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
        </div>
      )}
    </AdminSection>
  );
}
