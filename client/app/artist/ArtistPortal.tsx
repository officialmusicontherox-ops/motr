"use client";

import { useEffect, useState } from "react";

type Track = {
  id: string;
  title: string;
  status: string;
  opens: number;
  saves: number;
  addedAt: string;
};

type Me = { name: string; email: string; tracks: Track[] };

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

  if (loading) {
    return <p className="text-muted py-20 text-center text-sm">Loading...</p>;
  }

  if (needsSignIn || !me) return <SignIn />;

  return <Dashboard me={me} />;
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
    <div className="mx-auto w-full max-w-sm py-12">
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
    <div className="mx-auto w-full max-w-md py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl uppercase tracking-wide">Your tracks</h1>
        <p className="text-muted mt-1.5 text-sm leading-relaxed">
          Hi {me.name}. These move every time somebody swipes. Come back any time.
        </p>
      </header>

      {me.tracks.length === 0 ? (
        <p className="border-edge bg-surface text-muted rounded-xl border p-4 text-sm leading-relaxed">
          Nothing in the feed yet. Once a track is in, it shows up here.
        </p>
      ) : (
        <ul className="space-y-4">
          {me.tracks.map((t) => (
            <TrackCard key={t.id} track={t} />
          ))}
        </ul>
      )}

      <div className="border-edge bg-surface mt-6 rounded-xl border border-dashed p-4">
        <p className="text-muted text-xs leading-relaxed">
          A verdict reached after the full 30 seconds counts double, so one patient listener is
          worth two who skip.
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
  const shareUrl = `https://app.musicontherox.com/?track=${track.id}`;
  const caption = `My track "${track.title}" is on MOTR. Give it 30 seconds and swipe right if you like it: ${shareUrl}`;

  return (
    <li className="border-edge bg-surface rounded-2xl border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{track.title}</span>
        <span className="text-muted shrink-0 text-xs">
          {track.status === "DISCOVERY" ? "In rotation" : track.status.toLowerCase()}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat value={track.opens} label="opened your link" tone="gold" />
        <Stat value={track.saves} label="saved it" tone="green" />
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
            download={`motr-${slug(track.title)}-story.png`}
            className="bg-gold text-bg rounded-full px-4 py-2.5 text-center text-xs font-bold"
          >
            Download story card
          </a>
          <a
            href={`/api/share-card/${track.id}?shape=post`}
            download={`motr-${slug(track.title)}-post.png`}
            className="border-edge hover:border-gold rounded-full border px-4 py-2.5 text-center text-xs font-semibold transition"
          >
            Download post card
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

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "track";
