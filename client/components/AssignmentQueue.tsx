"use client";

import { useCallback, useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import { Crown } from "./icons";
import type { User } from "@/lib/types";

type Assignment = {
  id: string;
  status: string;
  assignedAt: string;
  track: {
    id: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    previewUrl: string;
    genre: string | null;
  };
  feature: { type: string; proofUrl: string; status: string } | null;
};

const TABS = ["PENDING", "FEATURED", "PASSED"] as const;

export default function AssignmentQueue({ curator }: { curator: User }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("PENDING");
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [passing, setPassing] = useState<string | null>(null);
  const [passReason, setPassReason] = useState("");

  const load = useCallback(
    async (status: string) => {
      setItems(null);
      setError(null);
      try {
        const res = await fetch(
          `/api/curator/assignments?userId=${curator.id}&status=${status}`
        );
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        setItems((await res.json()).assignments);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your queue");
      }
    },
    [curator.id]
  );

  useEffect(() => {
    setPassing(null);
    setPassReason("");
    load(tab);
  }, [tab, load]);

  async function act(assignmentId: string, body: Record<string, unknown>) {
    setBusy(assignmentId);
    const res = await fetch("/api/curator/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: curator.id, assignmentId, ...body }),
    });
    setBusy(null);
    if (!res.ok) {
      setError((await res.json()).error ?? "Action failed");
      return;
    }
    setOpenId(null);
    load(tab);
  }

  return (
    <MotrShell>
      <div className="w-full max-w-lg md:max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl uppercase tracking-wide">Your queue</h1>
            <p className="text-muted mt-1 text-sm">
              Share one to earn — playlist, TikTok/Reel/Short, or a write-up.
            </p>
          </div>
          <a
            href="/curator/earnings"
            className="border-gold/50 text-gold shrink-0 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest"
          >
            Earnings
          </a>
        </div>

        <div className="mt-5 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition ${
                tab === t
                  ? "bg-gold text-bg"
                  : "border-edge text-muted hover:border-gold/50 border hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && <p className="text-nope mt-4 text-sm">{error}</p>}

        {items === null ? (
          <div className="mt-12 flex justify-center">
            <Crown className="text-gold/30 h-8 w-8 animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-14 flex flex-col items-center gap-3 text-center">
            <Crown className="text-gold/40 h-10 w-10" />
            <p className="font-display text-xl uppercase tracking-wide">
              {tab === "PENDING" ? "Queue's empty" : `Nothing ${tab.toLowerCase()}`}
            </p>
            <p className="text-muted max-w-xs text-sm">
              {tab === "PENDING"
                ? "Tracks land here once fans push them through and the artist submits."
                : "Nothing to show in this tab yet."}
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {items.map((a) => (
              <li key={a.id} className="border-edge bg-surface rounded-2xl border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.track.title}</p>
                    <p className="text-gold truncate text-sm">{a.track.artistName}</p>
                    {a.track.genre && (
                      <span className="border-edge text-muted mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[0.65rem] uppercase tracking-widest">
                        {a.track.genre}
                      </span>
                    )}
                  </div>
                  {a.feature && (
                    <span className="text-muted shrink-0 text-[0.65rem] uppercase tracking-widest">
                      {a.feature.type} · {a.feature.status}
                    </span>
                  )}
                </div>

                <audio controls src={a.track.previewUrl} className="mt-4 w-full" />

                {a.status === "PENDING" && (
                  <div className="mt-4">
                    {openId === a.id ? (
                      <FeatureForm
                        busy={busy === a.id}
                        onCancel={() => setOpenId(null)}
                        onSubmit={(type, proofUrl) =>
                          act(a.id, { action: "FEATURE", type, proofUrl })
                        }
                      />
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setOpenId(a.id)}
                          className="bg-hot text-bg rounded-full px-4 py-2 text-sm font-bold"
                        >
                          I shared this
                        </button>
                        <button
                          onClick={() => setPassing(passing === a.id ? null : a.id)}
                          disabled={busy === a.id}
                          className="border-edge text-muted hover:text-white rounded-full border px-4 py-2 text-sm transition disabled:opacity-40"
                        >
                          {passing === a.id ? "Cancel" : "Pass"}
                        </button>
                      </div>
                    )}

                    {/* Passing needs a reason. It's the most useful thing an
                        artist gets from a no, and the only part of the fee
                        that pays off when the answer isn't yes. */}
                    {passing === a.id && (
                      <div className="border-edge mt-3 rounded-xl border p-3">
                        <label className="block text-xs text-muted">
                          Why are you passing? The artist sees this with your name on it — a
                          sentence or two is plenty.
                          <textarea
                            value={passReason}
                            onChange={(e) => setPassReason(e.target.value)}
                            rows={3}
                            placeholder="Not the right fit for my playlist — the production feels unfinished around the chorus, and my listeners skip anything that doesn't land by 0:20."
                            className="border-edge bg-bg focus:border-gold mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none transition placeholder:text-neutral-600"
                          />
                        </label>
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            onClick={() => act(a.id, { action: "PASS", reason: passReason })}
                            disabled={busy === a.id || passReason.trim().length < 15}
                            className="bg-gold text-bg rounded-full px-5 py-2 text-sm font-bold disabled:opacity-30"
                          >
                            {busy === a.id ? "Sending..." : "Send and pass"}
                          </button>
                          <span className="text-muted text-xs">
                            {passReason.trim().length < 15
                              ? `${15 - passReason.trim().length} more characters`
                              : "Goes to the artist with your name"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </MotrShell>
  );
}

const SHARE_TYPES = [
  {
    value: "PLAYLIST" as const,
    label: "Playlist",
    placeholder: "link to the playlist",
    hint: "Leave it on the playlist at least 4 days — we check before paying out.",
  },
  {
    value: "VIDEO" as const,
    label: "Video",
    placeholder: "link to the TikTok, Reel, or Short",
    hint: "TikTok, Reels, or Shorts. Keep the post up at least 4 days — we check before paying out.",
  },
  {
    value: "ARTICLE" as const,
    label: "Write-up",
    placeholder: "link to the article",
    hint: "Link the published piece.",
  },
];

function FeatureForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (type: "PLAYLIST" | "VIDEO" | "ARTICLE", proofUrl: string) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<"PLAYLIST" | "VIDEO" | "ARTICLE">("PLAYLIST");
  const [proofUrl, setProofUrl] = useState("");
  const active = SHARE_TYPES.find((t) => t.value === type)!;

  return (
    <div className="border-edge bg-surface-2 rounded-xl border p-4">
      <div className="flex flex-wrap gap-2">
        {SHARE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition ${
              type === t.value ? "bg-gold text-bg" : "border-edge text-muted border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        value={proofUrl}
        onChange={(e) => setProofUrl(e.target.value)}
        placeholder={active.placeholder}
        className="border-edge bg-bg focus:border-gold mt-3 w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition placeholder:text-neutral-600"
      />

      <p className="text-muted mt-2 text-xs leading-relaxed">{active.hint}</p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onSubmit(type, proofUrl)}
          disabled={busy || !proofUrl.trim()}
          className="bg-hot text-bg rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40"
        >
          {busy ? "Submitting..." : "Submit"}
        </button>
        <button
          onClick={onCancel}
          className="border-edge text-muted hover:text-white rounded-full border px-4 py-2 text-sm transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
