"use client";

import { useEffect, useState } from "react";
import { GENRES } from "@/lib/genres";
import MotrShell from "@/components/MotrShell";

type Track = {
  id: string;
  title: string;
  status: string;
  opens: number;
  saves: number;
  fullListens: number;
  savesThisWeek: number;
  counting: boolean;
  ai: boolean;
  genre: string | null;
  aiGenerated: boolean | null;
  pending: { genre: string | null; aiGenerated: boolean | null } | null;
  addedAt: string;
};

type Battle = { url: string; title: string; closes: string; result: "won" | "lost" | "tie" | null };

type Me = {
  name: string;
  email: string;
  week: string;
  chartPlace: number | null;
  battleWins: number;
  spotlight: { live: boolean; queued: boolean; total: number };
  battles: Battle[];
  tracks: Track[];
};

/**
 * An artist's own page: what their music is doing, and the card to post.
 *
 * One route for every artist. Nothing here is addressed by an artist id, so
 * there is no parameter anyone could edit to see somebody else's numbers: the
 * server reads who you are from the session cookie and answers only for that.
 */
export default function ArtistPortal() {
  const [me, setMe] = useState<Me | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guarded so a reply arriving after the artist has navigated away doesn't
    // set state on a component that is no longer there.
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/artist/me", { cache: "no-store" });
        if (!alive) return;
        if (res.status === 401) {
          setNeedsSignIn(true);
          return;
        }
        const body = await res.json();
        if (alive) setMe(body);
      } catch {
        if (alive) setNeedsSignIn(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // The same header, tabs and menu as every other page, so there is always
  // a way back into the app. This page used to stand alone with none.
  if (loading) {
    return (
      <MotrShell>
        <p className="text-muted py-20 text-center text-sm">Loading...</p>
      </MotrShell>
    );
  }

  if (needsSignIn || !me)
    return (
      <MotrShell>
        <SignIn />
      </MotrShell>
    );

  return (
    <MotrShell>
      <Dashboard me={me} />
    </MotrShell>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/artist/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setBusy(false);
    setSent(true);
  }

  return (
    <div className="mx-auto w-full max-w-sm py-6">
      <h1 className="font-display text-center text-3xl uppercase tracking-wide">Your page</h1>
      <p className="text-muted mt-3 text-center text-sm leading-relaxed">
        See how your music is doing on MOTR and get a card you can post.
      </p>

      {sent ? (
        <div className="border-edge bg-surface mt-6 rounded-2xl border p-5 text-center">
          <p className="text-sm leading-relaxed">
            If that address has music on MOTR, a sign-in link is on its way. It works once and
            lasts 30 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={request} className="mt-6 flex flex-col gap-3">
          <label htmlFor="artist-email" className="motr-label text-muted">
            The email you submitted with
          </label>
          <input
            id="artist-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border-edge bg-surface focus:border-gold rounded-xl border px-4 py-3 text-sm outline-none transition"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-gold text-bg rounded-full px-6 py-3.5 text-sm font-bold uppercase tracking-wide disabled:opacity-40"
          >
            {busy ? "Sending..." : "Email me a link"}
          </button>
        </form>
      )}
    </div>
  );
}

function Dashboard({ me }: { me: Me }) {
  return (
    <div className="mx-auto w-full max-w-md py-2 md:max-w-4xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl uppercase tracking-wide">Your tracks</h1>
        <p className="text-muted mt-1.5 text-sm leading-relaxed">
          Hi {me.name}. These move every time somebody swipes. Come back any time.
        </p>
      </header>

      {me.tracks.length > 0 && <ThisWeek me={me} />}

      {me.tracks.length === 0 ? (
        <p className="border-edge bg-surface text-muted rounded-xl border p-4 text-sm leading-relaxed">
          Nothing in the feed yet. Once a track is in, it shows up here.
        </p>
      ) : (
        // Two across on a laptop, so a wide screen is not one long column.
        <ul className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
          {me.tracks.map((t) => (
            <TrackCard key={t.id} track={t} />
          ))}
        </ul>
      )}

      <div className="border-edge bg-surface mt-6 space-y-2.5 rounded-xl border border-dashed p-4">
        <p className="text-muted text-xs leading-relaxed">
          A verdict reached after the full 30 seconds counts double, so one patient listener is
          worth two who skip.
        </p>
        <p className="text-muted text-xs leading-relaxed">
          The song chart, the artist chart and the weekly winner all count your two best songs
          each week. Send as many as you like: every one stays in the feed, and each is another
          chance to be one of your best two.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={async () => {
            await fetch("/api/artist/signout", { method: "POST" });
            window.location.href = "/artist";
          }}
          className="text-muted hover:text-ink text-xs underline underline-offset-4 transition"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function TrackCard({ track }: { track: Track }) {
  const [copied, setCopied] = useState(false);
  // Asking for a change to the song's details. It goes to the admin and
  // nothing changes until they approve it.
  const [editing, setEditing] = useState(false);
  const [genre, setGenre] = useState(track.genre ?? "");
  const [ai, setAi] = useState<"" | "yes" | "no">(
    track.aiGenerated === null ? "" : track.aiGenerated ? "yes" : "no"
  );
  const [pending, setPending] = useState(track.pending);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setProblem(null);
    const res = await fetch("/api/artist/track-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trackId: track.id,
        genre: genre || undefined,
        aiGenerated: ai === "" ? undefined : ai === "yes",
      }),
    }).catch(() => null);
    setSaving(false);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      setProblem(d.error ?? "Couldn't send that. Try again.");
      return;
    }
    setPending(d.request);
    setEditing(false);
  }
  const shareUrl = `https://app.musicontherox.com/?track=${track.id}`;
  const caption = `My track "${track.title}" is on MOTR. Give it 30 seconds and swipe right if you like it: ${shareUrl}`;

  return (
    <li className="border-edge bg-surface rounded-2xl border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">
          {track.title}
          {track.ai && (
            <span className="text-muted border-edge ml-2 rounded-full border px-1.5 py-px align-middle text-[0.6rem] font-semibold">
              AI
            </span>
          )}
        </span>
        <span className="text-muted shrink-0 text-xs">
          {track.status === "DISCOVERY" ? "In rotation" : track.status.toLowerCase()}
        </span>
      </div>

      <p className="text-muted mt-1 text-xs">
        {(track.genre ?? "No genre").split(" /")[0]} ·{" "}
        {track.aiGenerated === null ? "AI vocals not answered" : track.aiGenerated ? "AI vocals" : "No AI vocals"}
        {!editing && (
          <>
            {" · "}
            <button
              onClick={() => setEditing(true)}
              className="text-gold underline underline-offset-2"
            >
              Edit details
            </button>
          </>
        )}
      </p>

      {pending && !editing && (
        <p className="border-gold/40 bg-gold/5 mt-2 rounded-lg border px-3 py-2 text-xs">
          Sent for review:
          {pending.genre ? ` genre to ${pending.genre.split(" /")[0]}` : ""}
          {pending.genre && pending.aiGenerated !== null ? "," : ""}
          {pending.aiGenerated !== null ? ` AI vocals to ${pending.aiGenerated ? "yes" : "no"}` : ""}. It
          updates once approved.
        </p>
      )}

      {editing && (
        <div className="border-edge bg-surface-2 mt-2 space-y-2 rounded-xl border p-3">
          <label className="block text-xs">
            <span className="text-muted mb-1 block">Genre</span>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="border-edge bg-bg text-ink w-full rounded-lg border px-2 py-2 text-sm outline-none focus:border-gold"
            >
              {!track.genre && <option value="">Choose a genre</option>}
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-muted mb-1 block">Are the vocals AI-generated?</span>
            <select
              value={ai}
              onChange={(e) => setAi(e.target.value as "" | "yes" | "no")}
              className="border-edge bg-bg text-ink w-full rounded-lg border px-2 py-2 text-sm outline-none focus:border-gold"
            >
              {track.aiGenerated === null && <option value="">Choose one</option>}
              <option value="no">No AI vocals</option>
              <option value="yes">Yes, AI vocals</option>
            </select>
          </label>
          <p className="text-muted text-xs leading-relaxed">
            Changes are checked by MOTR before they show. Your song stays as it is until then.
          </p>
          {problem && <p className="text-nope text-xs">{problem}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="bg-gold text-bg flex-1 rounded-full py-2 text-xs font-bold disabled:opacity-40"
            >
              {saving ? "Sending..." : "Submit for review"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setProblem(null);
              }}
              className="border-edge text-muted hover:text-ink flex-1 rounded-full border py-2 text-xs font-semibold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-muted mt-1 text-xs">
        This week: {track.savesThisWeek} save{track.savesThisWeek === 1 ? "" : "s"}
        {track.counting && <span className="text-gold font-semibold"> · counting toward the chart</span>}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat value={track.saves} label="saved it" tone="green" />
        <Stat value={track.fullListens} label="heard all 30 seconds" tone="gold" />
        <Stat value={track.opens} label="opened your link" tone="gold" />
      </div>

      <div className="mt-4 flex gap-3">
        {/* The card itself, so there is no guessing what gets posted. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/share-card/${track.id}`}
          alt={`Share card for ${track.title}`}
          className="border-edge h-[121px] w-[68px] shrink-0 rounded-lg border object-cover"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <a
            href={`/api/share-card/${track.id}`}
            // Opened, not downloaded: see the submit page.
            target="_blank"
            rel="noreferrer"
            className="bg-gold text-bg rounded-full px-4 py-2.5 text-center text-xs font-bold"
          >
            Open story card
          </a>
          <a
            href={`/api/share-card/${track.id}?shape=post`}
            target="_blank"
            rel="noreferrer"
            className="border-edge hover:border-gold rounded-full border px-4 py-2.5 text-center text-xs font-semibold transition"
          >
            Open post card
          </a>
          <button
            onClick={() =>
              navigator.clipboard?.writeText(caption).then(
                () => setCopied(true),
                () => setCopied(false)
              )
            }
            className="border-edge hover:border-gold rounded-full border px-4 py-2.5 text-xs font-semibold transition"
          >
            {copied ? "Caption copied" : "Copy caption"}
          </button>
        </div>
      </div>

      <div className="border-edge mt-3 border-t pt-3">
        <div className="motr-label text-muted">Your link</div>
        <p className="text-gold mt-1 break-all text-xs">{shareUrl}</p>
      </div>
    </li>
  );
}

/**
 * The week at a glance: chart place, this week's battle, Battle Wins.
 * Their own standing only, never anybody else's numbers.
 */
function ThisWeek({ me }: { me: Me }) {
  return (
    <section className="border-edge bg-surface mb-5 rounded-2xl border p-4">
      <div className="motr-label text-muted">This week · {me.week}</div>

      <p className="mt-2 text-sm leading-relaxed">
        {me.chartPlace ? (
          <>
            You are <span className="text-gold font-bold">#{me.chartPlace}</span> on Top Artists.
          </>
        ) : (
          <>Not in the Top Artists ten yet. Your two best songs this week are what count.</>
        )}
      </p>

      <div className="border-edge mt-3 border-t pt-3">
        {me.battles.length === 0 ? (
          <p className="text-muted text-sm">
            Not in a battle this week. You will be paired as soon as another artist in your genre
            joins.
          </p>
        ) : (
          me.battles.map((b) => (
            <div key={b.url} className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm">
                <span className="block truncate font-semibold">Battle: {b.title}</span>
                <span className="text-muted text-xs">
                  {b.result === "won"
                    ? "You won this one."
                    : b.result
                      ? "Decided early this week."
                      : `Voting closes ${b.closes} at midnight Central.`}
                </span>
              </p>
              <a
                href={b.url}
                className="bg-gold text-bg shrink-0 rounded-full px-4 py-2 text-xs font-bold"
              >
                Open
              </a>
            </div>
          ))
        )}
        <p className="text-muted mt-2 text-xs">
          Battle Wins, all time: <span className="text-ink font-semibold">{me.battleWins}</span>
        </p>
      </div>

      {/* A listener backing them. Shown so they find out, and have
          something to share; never who bought it or how long is left. */}
      {me.spotlight.total > 0 && (
        <div className="border-edge mt-3 border-t pt-3">
          {me.spotlight.live ? (
            <p className="text-sm">
              <span className="text-gold font-semibold">You&apos;re in the Spotlight right now.</span>{" "}
              A listener put you there.{" "}
              <a href="/spotlight" className="text-gold underline underline-offset-2">
                See the Spotlight tab
              </a>
            </p>
          ) : me.spotlight.queued ? (
            <p className="text-sm">
              <span className="text-gold font-semibold">A listener has put you in the Spotlight.</span>{" "}
              It starts as soon as a place opens up.
            </p>
          ) : null}
          {me.spotlight.live && me.spotlight.queued && (
            <p className="text-muted mt-1 text-xs">Another one is waiting to start after this.</p>
          )}
          <p className="text-muted mt-1 text-xs">
            Times listeners have put you in the Spotlight:{" "}
            <span className="text-ink font-semibold">{me.spotlight.total}</span>
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: "gold" | "green" }) {
  return (
    <div className="bg-surface-2 rounded-xl px-3 py-2.5">
      <div className={`text-2xl font-bold leading-none ${tone === "gold" ? "text-gold" : "text-hot"}`}>
        {value}
      </div>
      <div className="text-muted mt-1 text-xs leading-tight">{label}</div>
    </div>
  );
}
