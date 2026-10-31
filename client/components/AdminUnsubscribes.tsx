"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Row = {
  kind: "artist" | "listener";
  id: string;
  name: string;
  email: string;
  at: string | null;
  by: string | null;
};

type Side = { id: string; name: string; optedOut: boolean; at: string | null } | null;

type Data = {
  rows: Row[];
  fresh: number;
  match: { email: string; artist: Side; listener: Side } | null;
};

/**
 * Who has unsubscribed, and taking someone off who asked by email.
 *
 * Not everyone uses the link. They reply asking to be removed, and honouring
 * that quickly is both the law and the cheaper option: a request ignored
 * becomes a spam complaint, which costs the sending domain far more than the
 * address was worth.
 */
export default function AdminUnsubscribes() {
  const [data, setData] = useState<Data | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async (lookup?: string) => {
    setBusy(true);
    setError(null);
    try {
      const q = lookup ? `?email=${encodeURIComponent(lookup)}` : "";
      const res = await fetch(`/api/admin/unsubscribes${q}`);
      if (!res.ok) throw new Error("Could not load unsubscribes.");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function set(address: string, subscribe: boolean) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/admin/unsubscribes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: address, subscribe }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not change that.");
      const who = [
        body.artists ? `${body.artists} artist` : null,
        body.listeners ? `${body.listeners} listener` : null,
      ]
        .filter(Boolean)
        .join(" and ");
      const music =
        body.tracks > 0
          ? body.optedOut
            ? `, and ${body.tracks} ${body.tracks === 1 ? "track" : "tracks"} taken out of rotation`
            : `, and ${body.tracks} ${body.tracks === 1 ? "track" : "tracks"} put back in rotation`
          : "";
      setNote(
        body.optedOut
          ? `${address} is off the list (${who})${music}.`
          : `${address} is back on the list (${who})${music}.`
      );
      await load(address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const when = (at: string | null) =>
    at ? new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "before this was recorded";

  const match = data?.match ?? null;
  const found = Boolean(match && (match.artist || match.listener));

  return (
    <AdminSection
      title={`Unsubscribes${data?.fresh ? ` (${data.fresh} new)` : ""}`}
      description="Who has come off the email list, and taking someone off who asked by reply instead of using the link."
      defaultOpen={false}
    >
      <p className="border-nope/40 bg-nope/5 text-muted mb-4 rounded-xl border p-3 text-sm leading-relaxed">
        Unsubscribing an <strong className="text-ink">artist</strong> takes their music out of
        rotation at the same time, because email is the only way the platform can reach them.
        Nothing is deleted, and putting them back on restores exactly the tracks that came out.
        A listener coming off changes nothing but their email.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNote(null);
          void load(email.trim());
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="someone@example.com"
          className="border-edge bg-surface focus:border-gold min-w-[260px] flex-1 rounded-xl border px-4 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="border-edge hover:border-gold rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {busy ? "Checking..." : "Look up"}
        </button>
      </form>

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}
      {note && <p className="text-gold mt-3 text-sm">{note}</p>}

      {match && !found && (
        <p className="text-muted mt-3 text-sm">
          No artist or listener has {match.email}. Nothing to change.
        </p>
      )}

      {match && found && (
        <div className="border-edge bg-surface mt-3 rounded-xl border p-4">
          <p className="text-sm font-semibold">{match.email}</p>

          {/* Both sides are shown even when only one exists, because one
              address can be an artist and a listener, and a request to be
              taken off means both. */}
          <ul className="mt-2 space-y-1 text-sm">
            {(["artist", "listener"] as const).map((k) => {
              const side = match[k];
              if (!side) {
                return (
                  <li key={k} className="text-muted">
                    No {k} account
                  </li>
                );
              }
              return (
                <li key={k}>
                  <span className="text-muted capitalize">{k}: </span>
                  {side.name}{" "}
                  {side.optedOut ? (
                    <span className="text-nope">off the list since {when(side.at)}</span>
                  ) : (
                    <span className="text-gold">still receiving emails</span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void set(match.email, false)}
              disabled={busy}
              className="border-nope/50 text-nope hover:bg-nope/10 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              Unsubscribe this address
            </button>
            <button
              onClick={() => void set(match.email, true)}
              disabled={busy}
              className="border-edge text-muted hover:text-ink rounded-xl border px-4 py-2 text-sm transition disabled:opacity-50"
            >
              Put back on
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="motr-label text-muted mb-2">
          Off the list {data ? `(${data.rows.length})` : ""}
        </p>
        {data && data.rows.length === 0 && (
          <p className="text-muted text-sm">Nobody has unsubscribed.</p>
        )}
        <ul className="space-y-1.5">
          {data?.rows.map((r) => (
            <li
              key={`${r.kind}-${r.id}`}
              className="border-edge flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm"
            >
              <span>
                <span className="text-muted mr-2 text-xs uppercase tracking-wide">{r.kind}</span>
                {r.name}
              </span>
              <span className="text-muted text-xs">
                {when(r.at)}
                {r.by ? ` · ${r.by === "link" ? "used the link" : "by you"}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </AdminSection>
  );
}
