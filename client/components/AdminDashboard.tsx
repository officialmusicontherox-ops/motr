"use client";

import { useCallback, useEffect, useState } from "react";
import AdminReviewQueues from "./AdminReviewQueues";
import AdminPayoutQueues from "./AdminPayoutQueues";
import AdminAudience from "./AdminAudience";
import AdminCurators from "./AdminCurators";
import AdminTracks from "./AdminTracks";

type Stats = {
 counts: {
 fans: number;
 curators: number;
 artists: number;
 fanSwipes: number;
 curatorSwipes: number;
 awaitingPayment: number;
 pendingSubmissions: number;
 pendingApplications: number;
 pendingFeatures: number;
 pendingWithdrawals: number;
 };
 tracksByStatus: Record<string, number>;
 revenue: { totalCents: number; paidCount: number };
 payouts: {
 owedCents: number;
 owedCount: number;
 paidOutCents: number;
 paidOutCount: number;
 };
 recentNotifications: {
 id: string;
 sentAt: string;
 track: { title: string; artistName: string };
 }[];
};

const money = (cents: number) =>
 (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const TABS = ["tracks", "payments", "artists", "curators"] as const;
type Tab = (typeof TABS)[number];

export default function AdminDashboard({
 admin,
 onLogout,
}: {
 admin: { id: string; email: string };
 onLogout: () => void;
}) {
 const [stats, setStats] = useState<Stats | null>(null);
 const [tab, setTab] = useState<Tab>("tracks");
 const [records, setRecords] = useState<Record<string, unknown>[] | null>(null);
 const [recordsError, setRecordsError] = useState<string | null>(null);

 const loadStats = useCallback(async () => {
 const res = await fetch("/api/admin/stats");
 if (res.ok) setStats(await res.json());
 }, []);

 const loadRecords = useCallback(async (kind: Tab) => {
 setRecords(null);
 setRecordsError(null);
 try {
 const res = await fetch(`/api/admin/records?kind=${kind}`);
 if (!res.ok) throw new Error(`Request failed (${res.status})`);
 const data = await res.json();
 setRecords(data[kind] ?? []);
 } catch (e) {
 // Surface the failure — silently rendering "none yet" makes a broken
 // fetch look like genuinely empty data.
 setRecordsError(e instanceof Error ? e.message : "Could not load records");
 }
 }, []);

 useEffect(() => {
 loadStats();
 }, [loadStats]);

 useEffect(() => {
 loadRecords(tab);
 }, [tab, loadRecords]);

 async function logout() {
 await fetch("/api/admin/logout", { method: "POST" });
 onLogout();
 }

 return (
 <main className="mx-auto min-h-screen max-w-6xl p-8">
 <header className="flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-6 ">
 <div>
 <h1 className="text-2xl font-semibold">Admin</h1>
 <p className="text-sm text-muted">{admin.email}</p>
 </div>
 <button
 onClick={logout}
 className="rounded-full border border-edge px-4 py-2 text-sm transition hover:border-gold hover:text-gold"
 >
 Sign out
 </button>
 </header>

 {!stats ? (
 <p className="mt-8 text-muted">Loading stats...</p>
 ) : (
 <>
 <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
 <Stat
 label="Revenue"
 value={money(stats.revenue.totalCents)}
 sub={`${stats.revenue.paidCount} paid`}
 />
 <Stat
 label="Owed to curators"
 value={money(stats.payouts.owedCents)}
 sub={`${stats.payouts.owedCount} share(s)`}
 />
 <Stat
 label="Paid out"
 value={money(stats.payouts.paidOutCents)}
 sub={`${stats.payouts.paidOutCount} share(s)`}
 />
 <Stat label="Artists" value={String(stats.counts.artists)} />
 <Stat
 label="Fans"
 value={String(stats.counts.fans)}
 sub={`${stats.counts.fanSwipes} swipes`}
 />
 <Stat label="Curators" value={String(stats.counts.curators)} />
 <Stat label="In discovery" value={String(stats.tracksByStatus.DISCOVERY ?? 0)} />
 <Stat label="With curators" value={String(stats.tracksByStatus.VETTING ?? 0)} />
 </section>

 <div className="mt-4 space-y-2">
 {stats.counts.awaitingPayment > 0 && (
 <Alert tone="amber">
 {stats.counts.awaitingPayment} track(s) hit the fan threshold and are awaiting
 artist payment.
 </Alert>
 )}
 {stats.counts.pendingSubmissions > 0 && (
 <Alert tone="sky">
 {stats.counts.pendingSubmissions} paid submission(s) waiting on your review.
 </Alert>
 )}
 {stats.counts.pendingApplications > 0 && (
 <Alert tone="violet">
 {stats.counts.pendingApplications} curator application(s) waiting on your review.
 </Alert>
 )}
 {stats.counts.pendingFeatures > 0 && (
 <Alert tone="emerald">
 {stats.counts.pendingFeatures} curator share(s) waiting to be verified.
 </Alert>
 )}
 {stats.counts.pendingWithdrawals > 0 && (
 <Alert tone="rose">
 {stats.counts.pendingWithdrawals} cashout request(s) to send.
 </Alert>
 )}
 </div>

 <AdminReviewQueues onChanged={loadStats} />
 <AdminPayoutQueues onChanged={loadStats} />

 <AdminAudience />


 <AdminCurators onChanged={loadStats} />



 <AdminTracks onChanged={loadStats} />

 <section className="mt-10">
 <h2 className="text-lg font-semibold">Records</h2>
 <div className="mt-3 flex gap-2">
 {TABS.map((t) => (
 <button
 key={t}
 onClick={() => setTab(t)}
 className={`rounded-full px-4 py-1.5 text-sm capitalize ${
 tab === t
 ? "bg-gold text-bg"
 : "border border-edge text-muted transition hover:border-gold/50 hover:text-white"
 }`}
 >
 {t}
 </button>
 ))}
 </div>

 {recordsError ? (
 <p className="mt-3 text-sm text-nope">
 Couldn&apos;t load {tab}: {recordsError}
 </p>
 ) : records === null ? (
 <p className="mt-3 text-sm text-muted">Loading {tab}...</p>
 ) : records.length === 0 ? (
 <p className="mt-3 text-sm text-muted">No {tab} yet.</p>
 ) : (
 <div className="mt-3 overflow-x-auto rounded-xl border border-edge">
 <table className="w-full text-left text-sm">
 <thead className="bg-surface-2 text-muted ">
 <tr>
 {Object.keys(records[0])
 .filter((k) => typeof records[0][k] !== "object")
 .slice(0, 7)
 .map((k) => (
 <th key={k} className="p-3">
 {k}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {records.map((r, i) => (
 <tr key={i} className="border-t border-edge">
 {Object.keys(records[0])
 .filter((k) => typeof records[0][k] !== "object")
 .slice(0, 7)
 .map((k) => (
 <td key={k} className="max-w-[16rem] truncate p-3">
 {String(r[k] ?? "—")}
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </section>

 <section className="mt-10 pb-16">
 <h2 className="text-lg font-semibold">Recent artist notifications</h2>
 {stats.recentNotifications.length === 0 ? (
 <p className="mt-3 text-sm text-muted">None sent yet.</p>
 ) : (
 <ul className="mt-3 space-y-2 text-sm">
 {stats.recentNotifications.map((n) => (
 <li
 key={n.id}
 className="rounded-lg border border-edge bg-surface p-3"
 >
 <span className="font-medium">{n.track.title}</span>{" "}
 <span className="text-muted">by {n.track.artistName}</span>
 <span className="ml-2 text-muted">
 {new Date(n.sentAt).toLocaleString()}
 </span>
 </li>
 ))}
 </ul>
 )}
 </section>
 </>
 )}
 </main>
 );
}

function Alert({
 tone,
 children,
}: {
 tone: "amber" | "sky" | "violet" | "emerald" | "rose";
 children: React.ReactNode;
}) {
 const tones = {
 amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
 sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
 violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
 emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
 rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
 };
 return <p className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</p>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
 return (
 <div className="rounded-xl border border-edge bg-surface p-4">
 <p className="text-sm text-muted">{label}</p>
 <p className="mt-1 text-2xl font-semibold">{value}</p>
 {sub && <p className="text-xs text-muted">{sub}</p>}
 </div>
 );
}
