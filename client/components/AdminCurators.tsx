"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Curator = {
  id: string;
  username: string;
  email: string;
  status: "ACTIVE" | "PAUSED" | "SUSPENDED" | "REMOVED";
  statusNote: string | null;
  statusChangedAt: string | null;
  joinedAt: string;

  outletName: string | null;
  outletType: string | null;
  outletUrl: string | null;
  audienceSize: number | null;
  socialLinks: string[];
  genres: string[];
  country: string | null;
  payoutDestination: string | null;
  pitch: string | null;

  work: { pending: number; featured: number; passed: number; expired: number };
  responseRate: number | null;
  featureRate: number | null;

  earnings: { held: number; available: number; withdrawn: number };
  totalEarnedCents: number;
  withdrawals: number;
};

type Action = {
  to: Curator["status"];
  label: string;
  /** Shown in the confirm step — plain language, no jargon. */
  effect: string;
  tone: "neutral" | "warn" | "danger" | "good";
  /** Anything that cuts someone off gets a typed confirmation. */
  requireTyping?: boolean;
};

const ACTIONS: Record<Curator["status"], Action[]> = {
  ACTIVE: [
    {
      to: "PAUSED",
      label: "Pause",
      tone: "neutral",
      effect:
        "They stop receiving new tracks but keep their account, their queue, and everything they've earned. Use this for a holiday or a backlog. You can unpause any time.",
    },
    {
      to: "SUSPENDED",
      label: "Suspend",
      tone: "danger",
      requireTyping: true,
      effect:
        "They're locked out of MOTR immediately and any tracks waiting in their queue are released back so other curators can take them. Earnings already verified are still owed to them. Use this when something's wrong.",
    },
  ],
  PAUSED: [
    {
      to: "ACTIVE",
      label: "Unpause",
      tone: "good",
      effect: "They go back into the rotation and start receiving tracks again.",
    },
    {
      to: "SUSPENDED",
      label: "Suspend",
      tone: "danger",
      requireTyping: true,
      effect:
        "They're locked out of MOTR immediately and any waiting tracks are released. Earnings already verified are still owed to them.",
    },
  ],
  SUSPENDED: [
    {
      to: "ACTIVE",
      label: "Reinstate",
      tone: "good",
      effect: "They can sign in again and go back into the rotation for new tracks.",
    },
    {
      to: "REMOVED",
      label: "Remove",
      tone: "danger",
      requireTyping: true,
      effect:
        "They're taken off the platform for good. Their record is kept — it has to be, because payouts and tax records point at it — but they can't sign in and won't appear in the roster. You can still reinstate them later if you change your mind.",
    },
  ],
  REMOVED: [
    {
      to: "ACTIVE",
      label: "Reinstate",
      tone: "good",
      effect: "They're back on the platform and can sign in and receive tracks again.",
    },
  ],
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATUS_STYLE: Record<Curator["status"], string> = {
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  PAUSED: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  SUSPENDED: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  REMOVED: "border-edge bg-surface-2 text-muted",
};

const STATUS_MEANS: Record<Curator["status"], string> = {
  ACTIVE: "Receiving tracks",
  PAUSED: "Not receiving new tracks",
  SUSPENDED: "Locked out",
  REMOVED: "Off the platform",
};

export default function AdminCurators({ onChanged }: { onChanged: () => void }) {
  const [curators, setCurators] = useState<Curator[] | null>(null);
  const [filter, setFilter] = useState<"all" | Curator["status"]>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ curator: Curator; action: Action } | null>(null);
  // Changing the sign-in address, for curators whose outlet email has no
  // Google account behind it — common for radio shows and podcasts.
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [editingPayout, setEditingPayout] = useState<string | null>(null);
  const [payoutDraft, setPayoutDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/curators${q}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setCurators((await res.json()).curators);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load curators");
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveEmail(curator: Curator) {
    setEmailNote(null);
    const res = await fetch("/api/admin/curators", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: curator.id, email: emailDraft.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setEmailNote(data.error ?? "Couldn't change it.");
      return;
    }
    setEmailNote(
      `${curator.username} now signs in with ${data.curator.email}. Tell them to use that Google account.`
    );
    setEditingEmail(null);
    setEmailDraft("");
    load();
  }

  async function savePayout(curator: Curator) {
    setEmailNote(null);
    const res = await fetch("/api/admin/curators", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: curator.id, payoutDestination: payoutDraft.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setEmailNote(data.error ?? "Couldn't save that.");
      return;
    }
    setEmailNote(`${curator.username} will be paid at ${data.curator.payoutDestination}.`);
    setEditingPayout(null);
    setPayoutDraft("");
    load();
  }

  async function apply(curator: Curator, action: Action, note: string) {
    const res = await fetch("/api/admin/curators", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: curator.id, status: action.to, note }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(null);

    if (!res.ok) {
      setError(data.error ?? "That didn't work");
      return;
    }

    setFlash(
      `${curator.username} is now ${STATUS_MEANS[action.to].toLowerCase()}.` +
        (data.releasedAssignments
          ? ` ${data.releasedAssignments} waiting track(s) released back to the pool.`
          : "")
    );
    load();
    onChanged();
  }

  return (
    <AdminSection
      title="Curators"
      description="Everyone approved to receive tracks, what they run, and what they're owed."
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "ACTIVE", "PAUSED", "SUSPENDED", "REMOVED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${
                filter === f
                  ? "bg-gold text-bg"
                  : "border border-edge text-muted transition hover:border-gold/50 hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {flash && (
        <p className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {flash}{" "}
          <button onClick={() => setFlash(null)} className="underline underline-offset-2">
            dismiss
          </button>
        </p>
      )}
      {error && <p className="mt-3 text-sm text-nope">{error}</p>}

      {curators === null ? (
        <p className="mt-4 text-sm text-muted">Loading...</p>
      ) : curators.length === 0 ? (
        <div className="mt-4 rounded-xl border border-edge bg-surface p-6 text-center">
          <p className="font-medium">No curators yet</p>
          <p className="mt-1 text-sm text-muted">
            Approve a curator application above and they&apos;ll appear here. Until you have
            curators, an artist who pays has nobody to review their track.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {curators.map((c) => {
            const open = openId === c.id;
            return (
              <li key={c.id} className="rounded-xl border border-edge bg-surface">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {c.username}
                      <span
                        title={STATUS_MEANS[c.status]}
                        className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${STATUS_STYLE[c.status]}`}
                      >
                        {c.status.toLowerCase()}
                      </span>
                      <span className="text-xs font-normal text-muted">
                        {STATUS_MEANS[c.status]}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {c.outletName ?? "no outlet on file"}
                      {c.outletType && ` · ${c.outletType}`}
                      {typeof c.audienceSize === "number" &&
                        ` · ${c.audienceSize.toLocaleString()} audience`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{c.email}</p>
                    {c.statusNote && (
                      <p className="mt-1 text-xs italic text-muted">Note: {c.statusNote}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gold">
                        {money(c.totalEarnedCents)}
                      </p>
                      <p className="text-[0.65rem] uppercase tracking-widest text-muted">
                        earned all time
                      </p>
                    </div>
                    <button
                      onClick={() => setOpenId(open ? null : c.id)}
                      className="rounded-full border border-edge px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:border-gold hover:text-gold"
                    >
                      {open ? "Hide details" : "Details & actions"}
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-edge p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Panel title="What they run">
                        <Row label="Outlet" value={c.outletName} />
                        <Row label="Type" value={c.outletType} />
                        <Row
                          label="Link"
                          value={
                            c.outletUrl ? (
                              <a
                                href={c.outletUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-gold underline underline-offset-2"
                              >
                                {c.outletUrl}
                              </a>
                            ) : null
                          }
                        />
                        <Row
                          label="Audience"
                          value={c.audienceSize?.toLocaleString() ?? null}
                        />
                        <Row label="Genres" value={c.genres.join(", ") || null} />
                        <Row label="Country" value={c.country} />
                        {c.socialLinks.length > 0 && (
                          <Row
                            label="Socials"
                            value={
                              <span className="flex flex-col gap-1">
                                {c.socialLinks.map((s) => (
                                  <a
                                    key={s}
                                    href={s}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="break-all text-gold underline underline-offset-2"
                                  >
                                    {s}
                                  </a>
                                ))}
                              </span>
                            }
                          />
                        )}
                      </Panel>

                      <Panel title="Track record">
                        <Row label="Waiting on them" value={String(c.work.pending)} />
                        <Row label="Shared" value={String(c.work.featured)} />
                        <Row label="Passed" value={String(c.work.passed)} />
                        <Row label="Expired" value={String(c.work.expired)} />
                        <Row
                          label="Responds to"
                          value={
                            c.responseRate === null
                              ? "no tracks yet"
                              : `${Math.round(c.responseRate * 100)}% of tracks sent`
                          }
                        />
                        <Row
                          label="Shares"
                          value={
                            c.featureRate === null
                              ? "nothing decided yet"
                              : `${Math.round(c.featureRate * 100)}% of what they decide on`
                          }
                        />
                        <Row
                          label="Joined"
                          value={new Date(c.joinedAt).toLocaleDateString()}
                        />
                      </Panel>

                      <Panel title="Money">
                        <Row label="Clearing" value={money(c.earnings.held)} />
                        <Row label="Available" value={money(c.earnings.available)} />
                        <Row label="Cashed out" value={money(c.earnings.withdrawn)} />
                        <Row label="Cashout requests" value={String(c.withdrawals)} />
                        <Row
                          label="Paid via"
                          value={c.payoutDestination ?? "nothing on file yet"}
                        />
                      </Panel>

                      <Panel title="Their pitch">
                        <p className="text-sm leading-relaxed text-muted">
                          {c.pitch ?? "No application on file."}
                        </p>
                      </Panel>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-4">
                      <a
                        href={`mailto:${c.email}?subject=${encodeURIComponent("MOTR")}`}
                        className="rounded-full border border-edge px-4 py-2 text-sm font-semibold transition hover:border-gold hover:text-gold"
                      >
                        Email {c.username}
                      </a>

                      <button
                        onClick={() => {
                          setEditingEmail(editingEmail === c.id ? null : c.id);
                          setEmailDraft(c.email);
                          setEmailNote(null);
                        }}
                        className="rounded-full border border-edge px-4 py-2 text-sm font-semibold transition hover:border-gold hover:text-gold"
                      >
                        {editingEmail === c.id ? "Cancel" : "Change sign-in email"}
                      </button>

                      <button
                        onClick={() => {
                          setEditingPayout(editingPayout === c.id ? null : c.id);
                          setPayoutDraft(c.payoutDestination ?? "");
                          setEmailNote(null);
                        }}
                        className="rounded-full border border-edge px-4 py-2 text-sm font-semibold transition hover:border-gold hover:text-gold"
                      >
                        {editingPayout === c.id ? "Cancel" : "Payout address"}
                      </button>

                      {ACTIONS[c.status].map((a) => (
                        <button
                          key={a.to}
                          onClick={() => setPending({ curator: c, action: a })}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            a.tone === "danger"
                              ? "border border-nope/40 text-nope hover:bg-nope/10"
                              : a.tone === "good"
                                ? "bg-hot text-bg"
                                : "border border-edge text-muted hover:border-gold hover:text-gold"
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>

                    {editingEmail === c.id && (
                      <div className="mt-3 rounded-xl border border-edge bg-bg p-3">
                        <p className="text-xs text-muted">
                          Sign-in is Google, so this has to be an address they can sign into
                          Google with. Their application moves too, so a resent welcome goes to
                          the right place.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <input
                            value={emailDraft}
                            onChange={(e) => setEmailDraft(e.target.value)}
                            placeholder="their-google-address@gmail.com"
                            className="min-w-[240px] flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-sm outline-none transition focus:border-gold"
                          />
                          <button
                            onClick={() => saveEmail(c)}
                            className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-bg"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}

                    {editingPayout === c.id && (
                      <div className="mt-3 rounded-xl border border-edge bg-bg p-3">
                        <p className="text-xs text-muted">
                          The email on their PayPal account. Doesn&apos;t have to match their
                          sign-in — most outlets are paid at their own domain. They can also set
                          this themselves on their earnings page.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <input
                            value={payoutDraft}
                            onChange={(e) => setPayoutDraft(e.target.value)}
                            placeholder="their-paypal@example.com"
                            className="min-w-[240px] flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-sm outline-none transition focus:border-gold"
                          />
                          <button
                            onClick={() => savePayout(c)}
                            className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-bg"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}

                    {emailNote && editingEmail === null && editingPayout === null && (
                      <p className="mt-3 text-sm text-muted">{emailNote}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pending && (
        <ConfirmDialog
          curator={pending.curator}
          action={pending.action}
          onCancel={() => setPending(null)}
          onConfirm={(note) => apply(pending.curator, pending.action, note)}
        />
      )}
    </AdminSection>
  );
}

/**
 * Every status change goes through here. It states the consequence in plain
 * words first, and anything that cuts someone off also needs their username
 * typed — so a misplaced click can't suspend the wrong person.
 */
function ConfirmDialog({
  curator,
  action,
  onCancel,
  onConfirm,
}: {
  curator: Curator;
  action: Action;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = !action.requireTyping || typed.trim() === curator.username;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-edge bg-surface p-6">
        <h3 className="text-lg font-semibold">
          {action.label} {curator.username}?
        </h3>

        <p className="mt-3 text-sm leading-relaxed text-muted">{action.effect}</p>

        {curator.work.pending > 0 && (action.to === "SUSPENDED" || action.to === "REMOVED") && (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            They have {curator.work.pending} track(s) waiting. Those will be released so other
            curators can pick them up.
          </p>
        )}

        {curator.earnings.available + curator.earnings.held > 0 &&
          (action.to === "SUSPENDED" || action.to === "REMOVED") && (
            <p className="mt-2 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-muted">
              They have {money(curator.earnings.available + curator.earnings.held)} not yet cashed
              out. This doesn&apos;t touch it — settle up separately if it&apos;s owed.
            </p>
          )}

        <label className="mt-4 block">
          <span className="text-sm font-semibold">Reason (optional)</span>
          <span className="mt-0.5 block text-xs text-muted">
            Only you see this. Helps you remember why, months later.
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. asked for a break until September"
            className="mt-2 w-full rounded-lg border border-edge bg-bg px-3 py-2.5 text-sm outline-none transition focus:border-gold placeholder:text-neutral-600"
          />
        </label>

        {action.requireTyping && (
          <label className="mt-4 block">
            <span className="text-sm font-semibold">
              Type <span className="text-gold">{curator.username}</span> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-edge bg-bg px-3 py-2.5 text-sm outline-none transition focus:border-gold"
            />
          </label>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full border border-edge px-5 py-2.5 text-sm font-semibold transition hover:text-white"
          >
            Cancel
          </button>
          <button
            disabled={!ready || busy}
            onClick={() => {
              setBusy(true);
              onConfirm(note);
            }}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition disabled:opacity-30 ${
              action.tone === "danger" ? "bg-nope text-white" : "bg-gold text-bg"
            }`}
          >
            {busy ? "Working..." : action.label}
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-edge bg-bg p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">{title}</p>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 flex-1">{value ?? <span className="text-muted">—</span>}</span>
    </div>
  );
}
