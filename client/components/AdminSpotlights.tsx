"use client";

import { useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Purchase = {
  id: string;
  at: string;
  credits: number;
  cents: number;
  sessionId: string;
  buyer: string;
  buyerId: string;
  holding: number;
};

type Spend = {
  id: string;
  at: string;
  startsAt: string | null;
  endsAt: string | null;
  artist: string;
  artistId: string;
  track: string | null;
  buyer: string;
  buyerId: string | null;
};

type Data = {
  slots: number;
  live: number;
  queued: number;
  totals: { purchases: number; credits: number; cents: number };
  purchases: Purchase[];
  spends: Spend[];
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** "2d 4h left", or "ended". */
function remaining(endsAt: string | null): string {
  if (!endsAt) return "waiting for a tile";
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const h = Math.floor(ms / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h left`;
}

/**
 * Who bought Spotlights and who they spent them on.
 *
 * Stripe cannot answer this on its own: a Spotlight charge sits in the same
 * dashboard as the $4 and $15 submission fees from the WordPress site, with
 * nothing to say which is which or who it was for.
 */
export default function AdminSpotlights() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/spotlights")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  return (
    <AdminSection title="Spotlights" description="Who bought one, and who they spent it on">
      {failed ? (
        <p className="text-muted text-sm">Couldn&apos;t load.</p>
      ) : !data ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="sold" value={String(data.totals.credits)} sub={`${data.totals.purchases} purchases`} />
            <Tile label="taken" value={money(data.totals.cents)} sub="before Stripe's fee" />
            <Tile label="on the tab now" value={`${data.live} of ${data.slots}`} sub={data.queued > 0 ? `${data.queued} waiting` : "none waiting"} />
            <Tile
              label="unspent"
              value={String(data.purchases.reduce((n, p) => n + 0, 0) + unspent(data))}
              sub="credits people hold"
            />
          </div>

          <h3 className="motr-label mb-2">Spent on</h3>
          {data.spends.length === 0 ? (
            <p className="text-muted mb-5 text-sm">Nobody has spent one yet.</p>
          ) : (
            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted motr-label">
                  <tr>
                    <th className="pb-2 pr-3">Artist</th>
                    <th className="pb-2 pr-3">Bought by</th>
                    <th className="pb-2 pr-3">Off the track</th>
                    <th className="pb-2 pr-3">When</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.spends.map((s) => {
                    const left = remaining(s.endsAt);
                    return (
                      <tr key={s.id} className="border-edge border-t">
                        <td className="py-2 pr-3 font-semibold">{s.artist}</td>
                        <td className="text-muted py-2 pr-3">{s.buyer}</td>
                        <td className="text-muted py-2 pr-3">{s.track ?? "from Saved"}</td>
                        <td className="text-muted py-2 pr-3 whitespace-nowrap">{when(s.at)}</td>
                        <td
                          className={`py-2 whitespace-nowrap ${
                            left === "ended" ? "text-muted" : "text-gold"
                          }`}
                        >
                          {left}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="motr-label mb-2">Purchases</h3>
          {data.purchases.length === 0 ? (
            <p className="text-muted text-sm">Nothing sold yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted motr-label">
                  <tr>
                    <th className="pb-2 pr-3">Buyer</th>
                    <th className="pb-2 pr-3">Bought</th>
                    <th className="pb-2 pr-3">Paid</th>
                    <th className="pb-2 pr-3">Still holding</th>
                    <th className="pb-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.purchases.map((p) => (
                    <tr key={p.id} className="border-edge border-t">
                      <td className="py-2 pr-3 font-semibold">{p.buyer}</td>
                      <td className="text-muted py-2 pr-3">
                        {p.credits} Spotlight{p.credits === 1 ? "" : "s"}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{money(p.cents)}</td>
                      <td className="text-muted py-2 pr-3 tabular-nums">{p.holding}</td>
                      <td className="text-muted py-2 whitespace-nowrap">{when(p.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* The reason this section exists: the Stripe id, so a charge
                  in their dashboard can be matched to a person and an
                  artist rather than guessed at against the submission
                  fees. */}
              <p className="text-muted mt-3 text-xs">
                Matching a charge in Stripe: the newest purchase is{" "}
                <span className="text-ink font-mono">{data.purchases[0].sessionId.slice(0, 22)}…</span>
              </p>
            </div>
          )}
        </>
      )}
    </AdminSection>
  );
}

/** Credits bought minus credits spent, across everyone shown. */
function unspent(d: Data): number {
  const held = new Map<string, number>();
  for (const p of d.purchases) held.set(p.buyerId, p.holding);
  return [...held.values()].reduce((a, b) => a + b, 0);
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-edge bg-surface rounded-xl border p-3">
      <p className="motr-label text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}
