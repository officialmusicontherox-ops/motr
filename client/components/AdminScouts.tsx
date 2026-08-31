"use client";

import { useEffect, useState } from "react";
import AdminSection from "./AdminSection";
import { ArrowOut } from "./icons";

type Scout = {
  id: string;
  email: string;
  name: string;
  company: string | null;
  status: "ACTIVE" | "SUSPENDED";
  lastSeenAt: string | null;
  createdAt: string;
};

/**
 * A&R accounts — who can see the data portal, and a way in to look at it
 * yourself.
 *
 * Access is granted by hand and never by signup: the portal shows how every
 * artist on the platform performs, which is exactly the thing that must not
 * be self-serve.
 */
export default function AdminScouts() {
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/scouts");
    if (res.ok) setScouts((await res.json()).scouts);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/admin/scouts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, company }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setNote(data.error ?? "Couldn't create that account.");
      return;
    }
    setNote(
      data.invited
        ? `${name} now has access and a sign-in link is on its way.`
        : `${name} now has access, but the invite email didn't send — use Re-send.`
    );
    setName("");
    setEmail("");
    setCompany("");
    load();
  }

  async function act(scoutId: string, action: "suspend" | "reinstate" | "resend") {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/admin/scouts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scoutId, action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNote(data.error ?? "That didn't work.");
      return;
    }
    if (action === "resend") setNote(data.sent ? "Sign-in link sent." : "The email didn't send.");
    load();
  }

  const active = scouts.filter((s) => s.status === "ACTIVE").length;

  return (
    <AdminSection
      title="A&amp;R access"
      description="Labels and scouts who can see how tracks perform blind. Invite-only, and revocable at any time."
      defaultOpen={false}
      badge={
        active > 0 ? (
          <span className="border-gold/40 bg-gold/10 text-gold rounded-full border px-2 py-0.5 text-xs">
            {active} active
          </span>
        ) : undefined
      }
    >
      <a
        href="/scout"
        target="_blank"
        rel="noreferrer"
        className="border-edge hover:border-gold hover:text-gold inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition"
      >
        Open the A&amp;R portal
        <ArrowOut className="h-4 w-4" />
      </a>
      <p className="text-muted mt-2 text-xs">
        Opens in a new tab. You&apos;ll need an A&amp;R account of your own to see it — add your
        own address below if you want to look at exactly what a label sees.
      </p>

      <form onSubmit={create} className="border-edge mt-5 grid gap-3 border-t pt-5 sm:grid-cols-3">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="border-edge bg-bg rounded-lg border px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border-edge bg-bg rounded-lg border px-3 py-2 text-sm"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Label / company (optional)"
          className="border-edge bg-bg rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-gold text-bg rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-40 sm:col-span-3 sm:justify-self-start"
        >
          {busy ? "Working..." : "Grant access & send link"}
        </button>
      </form>

      {note && (
        <p className="border-edge bg-bg text-muted mt-3 rounded-lg border px-3 py-2 text-sm">
          {note}
        </p>
      )}

      {scouts.length > 0 && (
        <ul className="mt-5 space-y-2">
          {scouts.map((s) => (
            <li
              key={s.id}
              className="border-edge bg-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {s.name}
                  {s.company && <span className="text-muted font-normal"> · {s.company}</span>}
                </p>
                <p className="text-muted truncate text-xs">{s.email}</p>
                <p className="text-muted/70 mt-0.5 text-xs">
                  {s.status === "SUSPENDED"
                    ? "Suspended"
                    : s.lastSeenAt
                      ? `Last signed in ${new Date(s.lastSeenAt).toLocaleDateString()}`
                      : "Never signed in"}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => act(s.id, "resend")}
                  disabled={busy || s.status === "SUSPENDED"}
                  className="border-edge hover:border-gold hover:text-gold rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40"
                >
                  Re-send link
                </button>
                <button
                  onClick={() => act(s.id, s.status === "ACTIVE" ? "suspend" : "reinstate")}
                  disabled={busy}
                  className="border-edge hover:border-nope hover:text-nope rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40"
                >
                  {s.status === "ACTIVE" ? "Suspend" : "Reinstate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
