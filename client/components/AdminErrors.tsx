"use client";

import { useCallback, useEffect, useState } from "react";

type ErrorRow = {
  id: string;
  source: "SERVER" | "CLIENT";
  message: string;
  count: number;
  path: string | null;
  method: string | null;
  stack: string | null;
  resolved: boolean;
  firstSeen: string;
  lastSeen: string;
};

type Counts = { open: number; resolved: number; last24h: number };

const VIEWS = [
  { key: "open", label: "Needs attention" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
] as const;

/** Plain-language explanation for the shapes that come up most. */
function explain(e: ErrorRow): string | null {
  const m = e.message.toLowerCase();
  if (m.includes("transaction") && m.includes("time"))
    return "The database was slow to respond. Usually a brief hiccup that fixes itself — Stripe retries payments automatically, so a payment affected by this still goes through.";
  if (m.includes("unique constraint"))
    return "Something was saved twice. Often harmless — usually a double-tap or a retry.";
  if (m.includes("fetch") || m.includes("network"))
    return "A request to an outside service failed. Could be Spotify, Deezer, Stripe or email being briefly unavailable.";
  if (m.includes("not configured") || m.includes("is not set"))
    return "A setting is missing in Vercel. This one won't fix itself.";
  if (e.source === "CLIENT")
    return "Something broke in a visitor's browser. If the count is climbing, it's affecting real people.";
  return null;
}

export default function AdminErrors() {
  const [view, setView] = useState<(typeof VIEWS)[number]["key"]>("open");
  const [errors, setErrors] = useState<ErrorRow[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/errors?view=${view}`);
    if (!res.ok) return;
    const d = await res.json();
    setErrors(d.errors);
    setCounts(d.counts);
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string | null, action: string) {
    await fetch("/api/admin/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    load();
  }

  return (
    <section className="mt-10 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Errors
            {counts && counts.open > 0 && (
              <span className="ml-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-300">
                {counts.open} open
              </span>
            )}
          </h2>
          <p className="text-sm text-muted">
            {counts?.open === 0
              ? "Nothing's gone wrong. This stays empty when the app is healthy."
              : "Problems the app hit, on the server or in someone's browser."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                view === v.key
                  ? "bg-gold text-bg"
                  : "border border-edge text-muted transition hover:border-gold/50 hover:text-white"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {counts && (
        <p className="mt-2 text-xs text-muted">
          {counts.last24h} occurrence(s) in the last 24 hours · {counts.resolved} resolved
          {counts.resolved > 0 && (
            <>
              {" · "}
              <button
                onClick={() => act(null, "CLEAR_RESOLVED")}
                className="underline underline-offset-2 hover:text-white"
              >
                clear resolved
              </button>
            </>
          )}
        </p>
      )}

      {errors === null ? (
        <p className="mt-4 text-sm text-muted">Loading...</p>
      ) : errors.length === 0 ? (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
          <p className="font-medium text-emerald-300">All clear</p>
          <p className="mt-1 text-sm text-muted">
            {view === "open"
              ? "No outstanding errors."
              : view === "resolved"
                ? "Nothing marked resolved yet."
                : "Nothing has been logged."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {errors.map((e) => {
            const open = openId === e.id;
            const why = explain(e);
            return (
              <li key={e.id} className="rounded-xl border border-edge bg-surface">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${
                          e.source === "SERVER"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                            : "border-sky-500/40 bg-sky-500/10 text-sky-300"
                        }`}
                      >
                        {e.source === "SERVER" ? "App" : "Browser"}
                      </span>
                      {e.count > 1 && (
                        <span className="rounded-full border border-edge px-2 py-0.5 text-[0.6rem] text-muted">
                          ×{e.count}
                        </span>
                      )}
                      <span className="min-w-0 break-words font-medium">{e.message}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {e.method && `${e.method} `}
                      {e.path ?? "unknown page"} · last seen{" "}
                      {new Date(e.lastSeen).toLocaleString()}
                    </p>
                    {why && <p className="mt-1.5 text-xs italic text-muted">{why}</p>}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {e.stack && (
                      <button
                        onClick={() => setOpenId(open ? null : e.id)}
                        className="rounded-full border border-edge px-3 py-1.5 text-xs text-muted transition hover:border-gold hover:text-gold"
                      >
                        {open ? "Hide" : "Details"}
                      </button>
                    )}
                    <button
                      onClick={() => act(e.id, e.resolved ? "REOPEN" : "RESOLVE")}
                      className="rounded-full border border-edge px-3 py-1.5 text-xs font-semibold transition hover:border-gold hover:text-gold"
                    >
                      {e.resolved ? "Reopen" : "Mark resolved"}
                    </button>
                  </div>
                </div>

                {open && e.stack && (
                  <pre className="overflow-x-auto border-t border-edge p-4 text-[0.7rem] leading-relaxed text-muted">
                    {e.stack}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
