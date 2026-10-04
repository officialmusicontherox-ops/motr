"use client";

import { useState } from "react";
import AdminSection from "./AdminSection";

type Track = { id: string; title: string; opens: number; saves: number };
type Artist = {
  id: string;
  name: string;
  email: string;
  optedOut: boolean;
  told: string | null;
  opens: number;
  saves: number;
  tracks: Track[];
};
type Data = {
  artists: Artist[];
  totals: { opens: number; promoting: number; untold: number };
};

/**
 * Who is bringing their own listeners, and the two buttons that act on it.
 *
 * Opens are the only number on this page an artist controls: saves follow
 * from the song, but a link is only opened because somebody posted it. So
 * this is the view that says who is doing the work, which is worth knowing
 * before deciding who to put effort into.
 */
export default function AdminArtistShare() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setBusy("load");
    setError(null);
    try {
      const res = await fetch("/api/admin/artist-share");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't load it");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load it");
    } finally {
      setBusy(null);
    }
  }

  async function post(body: Record<string, unknown>, key: string, done: (d: PostReply) => string) {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/admin/artist-share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "That didn't work.");
      setNote(done(d));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminSection
      title="Artist sharing"
      description="Who is sending their own listeners over, and the card each track gets."
      defaultOpen={false}
      badge={
        data && data.totals.untold > 0 ? (
          <span className="border-gold/40 bg-gold/10 text-gold rounded-full border px-2 py-0.5 text-xs">
            {data.totals.untold} not told yet
          </span>
        ) : undefined
      }
    >
      <p className="text-muted text-sm leading-relaxed">
        Every track has a link that opens the app on that song, and a card to post with a code
        people can scan. Opens count someone arriving from an artist&apos;s own link and getting
        their track.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={load}
          disabled={busy === "load"}
          className="border-edge hover:border-gold hover:text-gold rounded-full border px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40"
        >
          {busy === "load" ? "Checking..." : "Show who's promoting"}
        </button>

        {data && data.totals.untold > 0 && (
          <button
            onClick={() =>
              post({ action: "ANNOUNCE" }, "announce", (d) =>
                `Told ${d.sent ?? 0} artist${d.sent === 1 ? "" : "s"}${d.failed ? `, ${d.failed} failed` : ""}.`
              )
            }
            disabled={busy === "announce"}
            className="bg-gold text-bg rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-40"
          >
            {busy === "announce"
              ? "Sending..."
              : `Tell ${data.totals.untold} artist${data.totals.untold === 1 ? "" : "s"} about it`}
          </button>
        )}
      </div>

      {error && <p className="text-nope mt-3 text-sm">{error}</p>}
      {note && <p className="text-gold mt-3 text-sm">{note}</p>}

      {data && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="border-edge bg-surface rounded-xl border p-3">
              <div className="text-gold text-2xl font-bold leading-none">{data.totals.opens}</div>
              <div className="text-muted mt-1 text-xs">opens from artist links</div>
            </div>
            <div className="border-edge bg-surface rounded-xl border p-3">
              <div className="text-2xl font-bold leading-none">{data.totals.promoting}</div>
              <div className="text-muted mt-1 text-xs">
                of {data.artists.length} artists have brought someone
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {data.artists.map((a) => (
              <li key={a.id} className="border-edge bg-surface rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setOpen(open === a.id ? null : a.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="text-muted truncate text-xs">{a.email}</p>
                    <p className="mt-1 text-xs">
                      <span className="text-gold font-semibold">{a.opens}</span>
                      <span className="text-muted"> opens · </span>
                      <span className="font-semibold">{a.saves}</span>
                      <span className="text-muted"> saves · </span>
                      <span className="text-muted">
                        {a.tracks.length} track{a.tracks.length === 1 ? "" : "s"}
                      </span>
                      {!a.told && !a.optedOut && (
                        <span className="text-muted/70"> · not told yet</span>
                      )}
                      {a.optedOut && <span className="text-muted/70"> · opted out</span>}
                    </p>
                  </button>

                  <button
                    onClick={() =>
                      post({ action: "SEND_LINK", artistId: a.id }, a.id, (d) => `Link sent to ${d.sentTo}.`)
                    }
                    disabled={busy === a.id}
                    className="border-edge hover:border-gold hover:text-gold shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40"
                  >
                    {busy === a.id ? "Sending..." : "Send link"}
                  </button>
                </div>

                {open === a.id && (
                  <ul className="border-edge mt-3 space-y-2 border-t pt-3">
                    {a.tracks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{t.title}</span>
                          <span className="text-muted text-xs">
                            {t.opens} opens · {t.saves} saves
                          </span>
                        </span>
                        <a
                          href={`/api/share-card/${t.id}?shape=post`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gold shrink-0 text-xs underline underline-offset-4"
                        >
                          Card
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminSection>
  );
}

/** The shape of a POST reply, which differs per action. */
type PostReply = { sent?: number; failed?: number; sentTo?: string };
