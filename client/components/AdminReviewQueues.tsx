"use client";

import { useCallback, useEffect, useState } from "react";

type Submission = {
 id: string;
 title: string;
 artistName: string;
 fanRightSwipes: number;
 reviewStatus: string;
 reviewNote: string | null;
 artist: { name: string; email: string } | null;
 payment: { amountCents: number; currency: string; status: string } | null;
};

type Application = {
 id: string;
 email: string;
 username: string;
 pitch: string;
 status: string;
 reviewNote: string | null;
 outletName: string | null;
 country: string | null;
 outletType: string | null;
 outletUrl: string | null;
 audienceSize: number | null;
 socialLinks: string[];
 genres: string[];
};

const money = (cents: number) =>
 (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const FILTERS = ["PENDING", "APPROVED", "DECLINED"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminReviewQueues({ onChanged }: { onChanged: () => void }) {
 return (
 <>
 <SubmissionsQueue onChanged={onChanged} />
 <ApplicationsQueue onChanged={onChanged} />
 </>
 );
}

function FilterTabs({
 value,
 onChange,
}: {
 value: Filter;
 onChange: (f: Filter) => void;
}) {
 return (
 <div className="mt-3 flex gap-2">
 {FILTERS.map((f) => (
 <button
 key={f}
 onClick={() => onChange(f)}
 className={`rounded-full px-3 py-1 text-xs font-medium ${
 value === f
 ? "bg-gold text-bg"
 : "border border-edge text-muted transition hover:border-gold/50 hover:text-white"
 }`}
 >
 {f}
 </button>
 ))}
 </div>
 );
}

function SubmissionsQueue({ onChanged }: { onChanged: () => void }) {
 const [filter, setFilter] = useState<Filter>("PENDING");
 const [items, setItems] = useState<Submission[] | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [notice, setNotice] = useState<string | null>(null);
 const [busy, setBusy] = useState<string | null>(null);

 const load = useCallback(async (f: Filter) => {
 setItems(null);
 setError(null);
 try {
 const res = await fetch(`/api/admin/submissions?status=${f}`);
 if (!res.ok) throw new Error(`Request failed (${res.status})`);
 setItems((await res.json()).submissions);
 } catch (e) {
 setError(e instanceof Error ? e.message : "Could not load submissions");
 }
 }, []);

 useEffect(() => {
 load(filter);
 }, [filter, load]);  async function decide(trackId: string, decision: "APPROVE" | "DECLINE") {
    setBusy(trackId);
    const res = await fetch("/api/admin/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackId, decision }),
    });
    setBusy(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Action failed");
      return;
    }

    // Approving is only meaningful if it actually reached curators. Routing
    // to nobody is silent otherwise, and the artist has already paid.
    if (decision === "APPROVE") {
      const n = data.assignment?.assigned ?? 0;
      setNotice(
        n === 0
          ? "Approved — but it reached 0 curators, so nobody will review it. Approve some curator applications, then re-approve this track."
          : `Approved and routed to ${n} curator${n === 1 ? "" : "s"}.`
      );
    }

    load(filter);
    onChanged();
  }

 return (
 <section className="mt-10">
 <h2 className="text-lg font-semibold">Artist submissions</h2>
 <p className="text-sm text-muted">
 Paid submissions waiting to be cleared into the curator round.
 </p>
 <FilterTabs value={filter} onChange={setFilter} />

 {error && <p className="mt-3 text-sm text-nope">{error}</p>}
 {notice && (
   <p
     className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
       notice.includes("0 curators")
         ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
         : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
     }`}
   >
     {notice}
   </p>
 )}

 {items === null ? (
 <p className="mt-3 text-sm text-muted">Loading...</p>
 ) : items.length === 0 ? (
 <p className="mt-3 text-sm text-muted">Nothing {filter.toLowerCase()}.</p>
 ) : (
 <ul className="mt-3 space-y-3">
 {items.map((s) => (
 <li
 key={s.id}
 className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-surface p-4"
 >
 <div className="min-w-0">
 <p className="font-medium">
 {s.title}{" "}
 <span className="font-normal text-muted">by {s.artistName}</span>
 </p>
 <p className="text-xs text-muted">
 {s.fanRightSwipes} fan approvals
 {s.artist?.email ? ` · ${s.artist.email}` : ""}
 {s.payment ? ` · ${money(s.payment.amountCents)} ${s.payment.status}` : ""}
 </p>
 </div>

 {s.reviewStatus === "PENDING" ? (
 <div className="flex gap-2">
 <button
 onClick={() => decide(s.id, "APPROVE")}
 disabled={busy === s.id}
 className="rounded-full bg-hot px-4 py-1.5 text-sm font-bold text-bg disabled:opacity-40"
 >
 Approve
 </button>
 <button
 onClick={() => decide(s.id, "DECLINE")}
 disabled={busy === s.id}
 className="rounded-full border border-nope/40 px-4 py-1.5 text-sm font-medium text-nope disabled:opacity-40 "
 >
 Decline
 </button>
 </div>
 ) : (
 <span
 className={`text-sm font-medium ${
 s.reviewStatus === "APPROVED" ? "text-hot" : "text-nope"
 }`}
 >
 {s.reviewStatus}
 </span>
 )}
 </li>
 ))}
 </ul>
 )}
 </section>
 );
}

function ApplicationsQueue({ onChanged }: { onChanged: () => void }) {
 const [filter, setFilter] = useState<Filter>("PENDING");
 const [items, setItems] = useState<Application[] | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [busy, setBusy] = useState<string | null>(null);

 const load = useCallback(async (f: Filter) => {
 setItems(null);
 setError(null);
 try {
 const res = await fetch(`/api/admin/applications?status=${f}`);
 if (!res.ok) throw new Error(`Request failed (${res.status})`);
 setItems((await res.json()).applications);
 } catch (e) {
 setError(e instanceof Error ? e.message : "Could not load applications");
 }
 }, []);

 useEffect(() => {
 load(filter);
 }, [filter, load]);

 async function decide(applicationId: string, decision: "APPROVE" | "DECLINE") {
 setBusy(applicationId);
 const res = await fetch("/api/admin/applications", {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ applicationId, decision }),
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
 <h2 className="text-lg font-semibold">Curator applications</h2>
 <p className="text-sm text-muted">
 Approving creates the curator account automatically.
 </p>
 <FilterTabs value={filter} onChange={setFilter} />

 {error && <p className="mt-3 text-sm text-nope">{error}</p>}

 {items === null ? (
 <p className="mt-3 text-sm text-muted">Loading...</p>
 ) : items.length === 0 ? (
 <p className="mt-3 text-sm text-muted">Nothing {filter.toLowerCase()}.</p>
 ) : (
 <ul className="mt-3 space-y-3">
 {items.map((a) => (
 <li
 key={a.id}
 className="rounded-xl border border-edge bg-surface p-4"
 >
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="font-medium">
 {a.username}{" "}
 <span className="font-normal text-muted">· {a.email}</span>
 {a.country && (
   <span className="ml-2 rounded-full border border-edge px-2 py-0.5 text-[0.65rem] text-muted">
     {a.country}
   </span>
 )}
 </p>
 {/* The outlet is what the decision rests on — link it so you can
     go look before approving. */}
 {a.outletName && (
 <div className="mt-2 rounded-lg border border-edge bg-surface p-3">
 <p className="text-sm font-semibold">
 {a.outletName}
 {a.outletType && <span className="font-normal text-muted"> · {a.outletType}</span>}
 {typeof a.audienceSize === "number" && (
 <span className="ml-2 rounded-full border border-gold/40 px-2 py-0.5 text-[0.65rem] text-gold">
 {a.audienceSize.toLocaleString()} audience
 </span>
 )}
 </p>
 {a.outletUrl && (
 <a
 href={a.outletUrl}
 target="_blank"
 rel="noreferrer"
 className="mt-1 block break-all text-xs text-gold underline underline-offset-2"
 >
 {a.outletUrl}
 </a>
 )}
 {a.socialLinks?.length > 0 && (
 <div className="mt-2 flex flex-wrap gap-2">
 {a.socialLinks.map((s) => (
 <a
 key={s}
 href={s}
 target="_blank"
 rel="noreferrer"
 className="rounded-full border border-edge px-2.5 py-0.5 text-[0.65rem] text-muted underline-offset-2 hover:text-white"
 >
 {s.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32)}
 </a>
 ))}
 </div>
 )}
 {a.genres?.length > 0 && (
 <p className="mt-2 text-[0.65rem] uppercase tracking-widest text-muted">
 {a.genres.join(" · ")}
 </p>
 )}
 </div>
 )}
 <p className="mt-2 max-w-2xl text-sm text-muted">
 {a.pitch}
 </p>
 </div>

 {a.status === "PENDING" ? (
 <div className="flex shrink-0 gap-2">
 <button
 onClick={() => decide(a.id, "APPROVE")}
 disabled={busy === a.id}
 className="rounded-full bg-hot px-4 py-1.5 text-sm font-bold text-bg disabled:opacity-40"
 >
 Approve
 </button>
 <button
 onClick={() => decide(a.id, "DECLINE")}
 disabled={busy === a.id}
 className="rounded-full border border-nope/40 px-4 py-1.5 text-sm font-medium text-nope disabled:opacity-40 "
 >
 Decline
 </button>
 </div>
 ) : (
 <span
 className={`shrink-0 text-sm font-medium ${
 a.status === "APPROVED" ? "text-hot" : "text-nope"
 }`}
 >
 {a.status}
 </span>
 )}
 </div>
 </li>
 ))}
 </ul>
 )}
 </section>
 );
}
