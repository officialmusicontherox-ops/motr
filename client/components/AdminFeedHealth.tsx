"use client";

import { useState } from "react";
import AdminSection from "./AdminSection";

type BrokenTrack = {
  id: string;
  title: string;
  artistName: string;
  previewUrl: string;
};

type Mismatch = {
  id: string;
  title: string;
  artistName: string;
  actualTitle?: string;
  actualArtist?: string;
};

type Report = {
  checked: number;
  playable: number;
  broken: BrokenTrack[];
  identity: {
    checkedNow: number;
    matched: number;
    unverified: number;
    remaining: number;
    vouched: number;
    total: number;
    verified: number;
    throttled: boolean;
    mismatches: Mismatch[];
  };
  checkedAt: string;
};

/**
 * Confirms every track in the feed still has audio behind it.
 *
 * A dead preview is invisible: the track keeps its artwork, its title and
 * its play button, and simply makes no sound — which a listener reads as a
 * broken app rather than a broken track. Fifty-eight died overnight once and
 * nothing in this dashboard showed it.
 *
 * On demand rather than automatic, since it makes one request per track.
 */
export default function AdminFeedHealth() {
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [repairing, setRepairing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /**
   * Runs the check, then keeps going until nothing is left to verify.
   *
   * A track Apple has never been asked about costs one throttled search, so a
   * single request can only settle a dozen. That's why this used to look like
   * it gave up partway. The passes are automatic now: the first one does the
   * playability sweep, the rest chip at the identity queue until it's empty.
   * Once a track's Apple id is known it's settled in bulk, so the crawl only
   * ever happens once — later runs finish in a single pass.
   */
  async function check(recheckAll = false) {
    setRunning(true);
    setNote(null);
    try {
      const first = await fetch(
        `/api/admin/feed-health${recheckAll ? "?recheck=all" : ""}`,
        { method: "POST" }
      );
      if (!first.ok) {
        setNote("Couldn't run the check.");
        setRunning(false);
        return;
      }

      let latest: Report = await first.json();
      setReport(latest);

      // Bounded so a track Apple simply can't identify — which stays in the
      // queue forever — can't spin this loop indefinitely.
      for (let pass = 0; pass < 60 && latest.identity.remaining > 0; pass++) {
        const before = latest.identity.remaining;
        const res = await fetch("/api/admin/feed-health?identityOnly=1", { method: "POST" });
        if (!res.ok) break;
        const next = (await res.json()) as { identity: Report["identity"] };
        latest = { ...latest, identity: next.identity };
        setReport(latest);

        if (next.identity.throttled) {
          // Apple's limit resets on the minute. Waiting it out is the whole
          // difference between finishing the library and stopping a tenth of
          // the way in, which is what it did before.
          setNote("Apple's rate limit — waiting a moment, then carrying on.");
          await new Promise((r) => setTimeout(r, 30_000));
          setNote(null);
          continue;
        }
        // No progress and no throttling means every remaining track is one
        // Apple won't answer for; carrying on would repeat failed searches.
        if (next.identity.remaining >= before) break;
      }

      if (latest.identity.remaining > 0) {
        setNote(
          `${latest.identity.remaining} couldn't be identified — Apple's search doesn't ` +
            `surface them, which is common for small releases and doesn't mean the audio is wrong.`
        );
      }
    } catch {
      setNote("Couldn't run the check.");
    }
    setRunning(false);
  }

  async function repair(t: BrokenTrack) {
    setRepairing(t.id);
    const res = await fetch("/api/admin/feed-health", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackId: t.id }),
    });
    const data = await res.json().catch(() => ({}));
    setRepairing(null);

    if (!res.ok) {
      setNote(data.error ?? "Couldn't repair that one.");
      return;
    }
    setNote(`"${t.title}" now has working audio. Run the check again to confirm it's the right recording.`);
    setReport((r) =>
      r
        ? {
            ...r,
            broken: r.broken.filter((b) => b.id !== t.id),
            playable: r.playable + 1,
            // The repair cleared its verdict server-side, so it leaves the
            // wrong-audio list and goes back into the queue to be re-checked.
            identity: {
              ...r.identity,
              mismatches: r.identity.mismatches.filter((m) => m.id !== t.id),
              remaining: r.identity.remaining + 1,
            },
          }
        : r
    );
  }

  const wrongAudio = report?.identity?.mismatches ?? [];
  const allGood = report && report.broken.length === 0 && wrongAudio.length === 0;

  return (
    <AdminSection
      title="Feed health"
      description="Checks every track still has audio — and that the audio is the right recording."
      defaultOpen={false}
      badge={
        report ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${
              allGood
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/40 bg-rose-500/10 text-rose-300"
            }`}
          >
            {allGood
              ? "all clear"
              : [
                  report.broken.length ? `${report.broken.length} silent` : null,
                  wrongAudio.length ? `${wrongAudio.length} wrong audio` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => check(false)}
          disabled={running}
          className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-bg transition hover:brightness-110 disabled:opacity-40"
        >
          {running
            ? report
              ? `Checking... ${report.identity.verified} of ${report.identity.total}`
              : "Checking every track..."
            : "Run check"}
        </button>
        {/* Re-verifying everything used to be impossible: one throttled search
            per track meant a run could only ever get through a handful. Known
            tracks are settled by batched lookup now, so the whole library is a
            couple of requests. */}
        <button
          onClick={() => check(true)}
          disabled={running}
          className="rounded-full border border-edge px-4 py-2 text-sm font-semibold text-muted transition hover:border-gold hover:text-gold disabled:opacity-40"
        >
          Re-check everything
        </button>
        {report && (
          <span className="text-sm text-muted">
            {report.playable} of {report.checked} playing ·{" "}
            {/* The number that was missing: how much of the library carries a
                verdict at all, rather than how many one run happened to do. */}
            <span className={report.identity.remaining === 0 ? "text-emerald-300" : "text-amber-300"}>
              {report.identity.verified} of {report.identity.total} verified
            </span>
            {report.identity.remaining > 0 ? ` · ${report.identity.remaining} still to check` : ""}
            {report.identity.vouched > 0
              ? ` · ${report.identity.vouched} trusted (audio you supplied by hand, not matched)`
              : ""}{" "}
            · {new Date(report.checkedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {note && (
        <p className="mt-3 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-muted">
          {note}
        </p>
      )}

      {!report && !running && (
        <p className="mt-3 text-sm text-muted">
          Worth running weekly, or any time someone reports a track that won&apos;t play. It keeps
          going until the whole library is done, so the first full run can take a few minutes.
        </p>
      )}

      {allGood && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
          Every track in the feed has working audio, and everything checked so far is the
          recording it claims to be.
        </p>
      )}

      {/* Wrong audio first: a silent track annoys a listener, but a track
          playing someone else's song is what loses an artist. */}
      {wrongAudio.length > 0 && (
        <>
          <p className="mt-4 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            These are playing the wrong recording — they sound fine, they&apos;re just not the
            song. Repair looks the track up again with the corrected matching.
          </p>
          <ul className="mt-3 space-y-2">
            {wrongAudio.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="truncate text-sm text-muted">{t.artistName}</p>
                  {t.actualTitle && (
                    <p className="mt-0.5 truncate text-xs text-rose-300">
                      actually playing &ldquo;{t.actualTitle}&rdquo; by {t.actualArtist}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => repair({ ...t, previewUrl: "" } as BrokenTrack)}
                  disabled={repairing === t.id}
                  className="shrink-0 rounded-full border border-edge px-4 py-1.5 text-sm font-semibold transition hover:border-gold hover:text-gold disabled:opacity-40"
                >
                  {repairing === t.id ? "Repairing..." : "Repair"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {report && report.broken.length > 0 && (
        <>
          <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            These play silently for listeners. Repair looks the track up again on Apple, whose
            links don&apos;t expire; if Apple doesn&apos;t have it, pull it from Tracks instead.
          </p>
          <ul className="mt-3 space-y-2">
            {report.broken.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="truncate text-sm text-muted">{t.artistName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted/70">
                    {t.previewUrl.includes("dzcdn")
                      ? "Deezer link — these expire, which is why it stopped"
                      : t.previewUrl.slice(0, 60)}
                  </p>
                </div>
                <button
                  onClick={() => repair(t)}
                  disabled={repairing === t.id}
                  className="shrink-0 rounded-full border border-edge px-4 py-1.5 text-sm font-semibold transition hover:border-gold hover:text-gold disabled:opacity-40"
                >
                  {repairing === t.id ? "Repairing..." : "Repair"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminSection>
  );
}
