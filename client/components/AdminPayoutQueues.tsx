"use client";

import { useCallback, useEffect, useState } from "react";

type Feature = {
 id: string;
 type: "PLAYLIST" | "VIDEO" | "ARTICLE";
 proofUrl: string;
 placedAt: string;
 holdUntil: string;
 holdElapsed: boolean;
 status: string;
 rejectedReason: string | null;
 assignment: {
 user: { username: string; email: string };
 track: { title: string; artistName: string };
 };
 payout: { amountCents: number; status: string } | null;
};

type Withdrawal = {
 id: string;
 amountCents: number;
 feeCents: number;
 netCents: number | null;
 status: string;
 payoutDestination: string | null;
 requestedAt: string;
 user: { username: string; email: string };
 _count: { payouts: number };
};

const money = (cents: number) =>
 (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function AdminPayoutQueues({ onChanged }: { onChanged: () => void }) {
 return (
 <>
 <FeaturesQueue onChanged={onChanged} />
 <WithdrawalsQueue onChanged={onChanged} />
 </>
 );
}

function Tabs<T extends string>({
 options,
 value,
 onChange,
}: {
 options: readonly T[];
 value: T;
 onChange: (v: T) => void;
}) {
 return (
 <div className="mt-3 flex gap-2">
 {options.map((o) => (
 <button
 key={o}
 onClick={() => onChange(o)}
 className={`rounded-full px-3 py-1 text-xs font-medium ${
 value === o
 ? "bg-gold text-bg"
 : "border border-edge text-muted transition hover:border-gold/50 hover:text-white"
 }`}
 >
 {o}
 </button>
 ))}
 </div>
 );
}

const FEATURE_TABS = ["SUBMITTED", "VERIFIED", "REJECTED"] as const;

function FeaturesQueue({ onChanged }: { onChanged: () => void }) {
 const [filter, setFilter] = useState<(typeof FEATURE_TABS)[number]>("SUBMITTED");
 const [items, setItems] = useState<Feature[] | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [busy, setBusy] = useState<string | null>(null);

 const load = useCallback(async (f: string) => {
 setItems(null);
 setError(null);
 try {
 const res = await fetch(`/api/admin/features?status=${f}`);
 if (!res.ok) throw new Error(`Request failed (${res.status})`);
 setItems((await res.json()).features);
 } catch (e) {
 setError(e instanceof Error ? e.message : "Could not load shares");
 }
 }, []);

 useEffect(() => {
 load(filter);
 }, [filter, load]);

 async function decide(featureId: string, decision: "VERIFY" | "REJECT") {
 setBusy(featureId);
 const res = await fetch("/api/admin/features", {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ featureId, decision }),
 });
 setBusy(null);
 if (!res.ok) {
 setError((await res.json()).error ?? "Action failed");
 return;
 }
 load(filter);
 onChanged();
 }

 return (
 <section className="mt-10">
 <h2 className="text-lg font-semibold">Curator shares</h2>
 <p className="text-sm text-muted">
 Verify a share to pay the curator. Playlist adds and videos must clear their hold first.
 </p>
 <Tabs options={FEATURE_TABS} value={filter} onChange={setFilter} />

 {error && <p className="mt-3 text-sm text-nope">{error}</p>}

 {items === null ? (
 <p className="mt-3 text-sm text-muted">Loading...</p>
 ) : items.length === 0 ? (
 <p className="mt-3 text-sm text-muted">Nothing {filter.toLowerCase()}.</p>
 ) : (
 <ul className="mt-3 space-y-3">
 {items.map((f) => (
 <li
 key={f.id}
 className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-surface p-4"
 >
 <div className="min-w-0">
 <p className="font-medium">
 {f.assignment.track.title}{" "}
 <span className="font-normal text-muted">
 by {f.assignment.track.artistName}
 </span>
 </p>
 <p className="text-xs text-muted">
 {f.type} · {f.assignment.user.username} ·{" "}
 <a
 href={f.proofUrl}
 target="_blank"
 rel="noreferrer"
 className="underline underline-offset-2"
 >
 proof
 </a>
 {f.type !== "ARTICLE" && (
 <>
 {" "}
 ·{" "}
 {f.holdElapsed ? (
 <span className="text-hot">hold cleared</span>
 ) : (
 <span className="text-amber-600">
 holds until {new Date(f.holdUntil).toLocaleDateString()}
 </span>
 )}
 </>
 )}
 {f.payout && ` · paid ${money(f.payout.amountCents)}`}
 </p>
 </div>

 {f.status === "SUBMITTED" ? (
 <div className="flex gap-2">
 <button
 onClick={() => decide(f.id, "VERIFY")}
 disabled={busy === f.id || !f.holdElapsed}
 title={!f.holdElapsed ? "Hold period hasn't elapsed yet" : undefined}
 className="rounded-full bg-hot px-4 py-1.5 text-sm font-bold text-bg disabled:opacity-40"
 >
 Verify &amp; pay
 </button>
 <button
 onClick={() => decide(f.id, "REJECT")}
 disabled={busy === f.id}
 className="rounded-full border border-nope/40 px-4 py-1.5 text-sm font-medium text-nope disabled:opacity-40 "
 >
 Reject
 </button>
 </div>
 ) : (
 <span
 className={`text-sm font-medium ${
 f.status === "VERIFIED" ? "text-hot" : "text-nope"
 }`}
 >
 {f.status}
 </span>
 )}
 </li>
 ))}
 </ul>
 )}
 </section>
 );
}

const WITHDRAWAL_TABS = ["REQUESTED", "PAID", "REJECTED"] as const;

function WithdrawalsQueue({ onChanged }: { onChanged: () => void }) {
 const [filter, setFilter] = useState<(typeof WITHDRAWAL_TABS)[number]>("REQUESTED");
 const [items, setItems] = useState<Withdrawal[] | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [busy, setBusy] = useState<string | null>(null);

 const load = useCallback(async (f: string) => {
 setItems(null);
 setError(null);
 try {
 const res = await fetch(`/api/admin/withdrawals?status=${f}`);
 if (!res.ok) throw new Error(`Request failed (${res.status})`);
 setItems((await res.json()).withdrawals);
 } catch (e) {
 setError(e instanceof Error ? e.message : "Could not load cashouts");
 }
 }, []);

 useEffect(() => {
 load(filter);
 }, [filter, load]);

 async function decide(withdrawalId: string, decision: "PAID" | "REJECTED") {
 setBusy(withdrawalId);
 const res = await fetch("/api/admin/withdrawals", {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ withdrawalId, decision }),
 });
 setBusy(null);
 if (!res.ok) {
 setError((await res.json()).error ?? "Action failed");
 return;
 }
 load(filter);
 onChanged();
 }

 return (
 <section className="mt-10">
 <h2 className="text-lg font-semibold">Cashout requests</h2>
 <p className="text-sm text-muted">
 Send the money, then mark it paid. Rejecting returns the balance to the curator.
 </p>
 <Tabs options={WITHDRAWAL_TABS} value={filter} onChange={setFilter} />

 {error && <p className="mt-3 text-sm text-nope">{error}</p>}

 {items === null ? (
 <p className="mt-3 text-sm text-muted">Loading...</p>
 ) : items.length === 0 ? (
 <p className="mt-3 text-sm text-muted">Nothing {filter.toLowerCase()}.</p>
 ) : (
 <ul className="mt-3 space-y-3">
 {items.map((w) => (
 <li
 key={w.id}
 className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-surface p-4"
 >
 <div className="min-w-0">
 <p className="font-medium">
 {money(w.netCents ?? w.amountCents)}{" "}
 <span className="font-normal text-muted">to {w.user.username}</span>
 </p>
 <p className="text-xs text-muted">
 {w.payoutDestination ?? "no destination on file"} · {w._count.payouts} share(s) ·{" "}
 {new Date(w.requestedAt).toLocaleDateString()}
 {w.feeCents > 0 &&
   ` · ${money(w.amountCents)} earned less ${money(w.feeCents)} fee`}
 </p>
 </div>

 {w.status === "REQUESTED" ? (
 <div className="flex gap-2">
 <button
 onClick={() => decide(w.id, "PAID")}
 disabled={busy === w.id}
 className="rounded-full bg-hot px-4 py-1.5 text-sm font-bold text-bg disabled:opacity-40"
 >
 Mark paid
 </button>
 <button
 onClick={() => decide(w.id, "REJECTED")}
 disabled={busy === w.id}
 className="rounded-full border border-nope/40 px-4 py-1.5 text-sm font-medium text-nope disabled:opacity-40 "
 >
 Reject
 </button>
 </div>
 ) : (
 <span
 className={`text-sm font-medium ${
 w.status === "PAID" ? "text-hot" : "text-nope"
 }`}
 >
 {w.status}
 </span>
 )}
 </li>
 ))}
 </ul>
 )}
 </section>
 );
}
