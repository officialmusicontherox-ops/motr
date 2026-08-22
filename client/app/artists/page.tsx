"use client";

import PageNav from "@/components/PageNav";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Crown } from "@/components/icons";
import { GENRES } from "@/lib/genres";

/** Songs per submission. Past this they start a fresh batch. */
const MAX_SONGS = 5;

type SongRow = { url: string; genre: string };
type Accepted = { id: string; title: string; artistName: string };
type Rejected = { url: string; reason: string };

export default function ArtistsPage() {
  const [artistEmail, setArtistEmail] = useState("");
  // The email is asked once and every song in the batch goes under it. Making
  // an artist retype it per track was the whole reason anyone submitted one
  // song at a time.
  const [songs, setSongs] = useState<SongRow[]>([{ url: "", genre: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<{ at: number; of: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState<{ accepted: Accepted[]; rejected: Rejected[] } | null>(null);

  const filled = songs.filter((s) => s.url.trim() && s.genre);
  const canSubmit = filled.length > 0 && artistEmail.trim() && !pending;

  function setSong(i: number, patch: Partial<SongRow>) {
    setSongs((prev) => prev.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const accepted: Accepted[] = [];
    const rejected: Rejected[] = [];

    // One request per song rather than one big one: each lookup hits Spotify
    // and Apple and takes a few seconds, and five of those in a single
    // request would sit too close to the serverless timeout. Sequential, so
    // a batch can't race itself creating the same artist twice.
    for (let i = 0; i < filled.length; i++) {
      setProgress({ at: i + 1, of: filled.length });
      const song = filled[i];
      try {
        const res = await fetch("/api/tracks/ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: "SPOTIFY",
            spotifyUrl: song.url.trim(),
            artistEmail,
            genre: song.genre,
            // Held back so the whole batch is confirmed in one email.
            deferEmail: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          rejected.push({ url: song.url.trim(), reason: data.error ?? "Couldn't add that one." });
        } else if (data.alreadyExisted) {
          rejected.push({ url: song.url.trim(), reason: "That track is already in the feed." });
        } else {
          accepted.push({
            id: data.track.id,
            title: data.track.title,
            artistName: data.track.artistName,
          });
        }
      } catch {
        rejected.push({ url: song.url.trim(), reason: "Network problem — try that one again." });
      }
    }

    // Only now does anyone get told, and only once.
    if (accepted.length > 0) {
      await fetch("/api/tracks/submission-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artistEmail, trackIds: accepted.map((a) => a.id) }),
      }).catch(() => {});
    }

    setPending(false);
    setProgress(null);

    if (accepted.length === 0) {
      setError(rejected[0]?.reason ?? "Could not submit that track");
      return;
    }
    setDone({ accepted, rejected });
  }

  if (done) {
    const many = done.accepted.length > 1;
    return (
      <main className="bg-bg min-h-screen">
        <PageNav />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-12 text-center">
          <Crown className="text-gold h-12 w-12" />
          <h1 className="font-display text-3xl uppercase tracking-wide">
            {many ? "You're in the feed" : "You're in the feed"}
          </h1>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            {many
              ? `All ${done.accepted.length} are live for fans to swipe on.`
              : `${done.accepted[0].title} by ${done.accepted[0].artistName} is live for fans to swipe on.`}
          </p>

          {/* Anything that didn't make it, named — so they can fix just that
              one rather than wondering which of five failed. */}
          {done.rejected.length > 0 && (
            <div className="border-nope/40 bg-nope/5 w-full rounded-2xl border p-4 text-left">
              <p className="text-nope text-sm font-semibold">
                {done.rejected.length} didn&apos;t go through
              </p>
              <ul className="mt-2 space-y-2">
                {done.rejected.map((r) => (
                  <li key={r.url} className="text-xs leading-relaxed">
                    <span className="text-muted block break-all">{r.url}</span>
                    <span className="text-muted/90">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The share ask goes here rather than in an email: this is the
              moment they've just finished and are most likely to act, and it
              doesn't depend on an email being opened. */}
          <div className="border-gold/40 bg-surface mt-2 w-full rounded-2xl border p-5 text-left">
            <p className="font-display text-gold text-lg uppercase tracking-wide">
              Now bring your people
            </p>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Nothing reaches curators without listeners backing it first, and your own fans are
              the ones most likely to swipe right.{" "}
              {many ? "Each link opens on that track" : "This link opens on your track"} — not a
              random one — so everyone you send lands straight on it.
            </p>

            {done.accepted.map((t) => {
              const shareUrl = `https://app.musicontherox.com/?track=${t.id}`;
              // Asking for the full listen isn't a nicety: a verdict reached
              // after the whole clip counts double, so one patient fan is
              // worth two who skip.
              const shareText = `My track "${t.title}" is on MOTR — give it the full 30 seconds, then swipe right if you like it (full listens count double): ${shareUrl}`;
              return (
                <div key={t.id} className="border-edge bg-bg mt-3 rounded-xl border p-3">
                  <p className="text-sm font-semibold text-white">{t.title}</p>
                  <p className="text-gold mt-1 break-all text-xs">{shareUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        navigator.clipboard?.writeText(shareText).then(
                          () => setCopied(t.id),
                          () => setCopied(null)
                        )
                      }
                      className="bg-gold text-bg rounded-full px-4 py-2 text-xs font-bold"
                    >
                      {copied === t.id ? "Copied" : "Copy post"}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="border-edge hover:border-gold rounded-full border px-4 py-2 text-xs font-semibold transition"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="border-edge hover:border-gold rounded-full border px-4 py-2 text-xs font-semibold transition"
                    >
                      X
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-muted max-w-sm text-xs leading-relaxed">
            We&apos;ve emailed {artistEmail} with {many ? "all of these links" : "this link"}.
            We&apos;ll be in touch the moment {many ? "one of them breaks" : "it breaks"} through.
          </p>

          <div className="mt-1 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                setDone(null);
                setSongs([{ url: "", genre: "" }]);
                setCopied(null);
                setError(null);
              }}
              className="border-edge hover:border-gold rounded-full border px-6 py-3 text-sm font-semibold transition"
            >
              Submit {MAX_SONGS} more
            </button>
            <Link
              href="/"
              className="bg-gold text-bg rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide"
            >
              Go swipe
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-bg min-h-screen pb-20">
      <PageNav />
      <header className="border-edge border-b px-6 py-8 text-center">
        <Link href="/" aria-label="MOTR home" className="inline-block">
          <Image
            src="/motr-logo.png"
            alt="MOTR"
            width={1000}
            height={550}
            className="mx-auto h-12 w-auto"
          />
        </Link>
        <h1 className="font-display mt-6 text-4xl uppercase tracking-wide">Submit your song</h1>
        <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
          Free to enter. Paste your Spotify link and fans start hearing it — no fee unless the
          crowd pushes you through to curators.
        </p>
      </header>

      <form onSubmit={submit} className="mx-auto mt-8 flex max-w-lg flex-col gap-5 px-6">
        {/* Asked once, at the top, and it covers every song below it. */}
        <label className="block">
          <span className="motr-label block">Your email</span>
          <span className="text-muted mb-2 mt-1 block text-xs">
            Asked once — every song you add below goes under this address.
          </span>
          <input
            type="email"
            value={artistEmail}
            onChange={(e) => setArtistEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="border-edge bg-surface focus:border-gold w-full rounded-xl border px-4 py-3 outline-none transition placeholder:text-neutral-600"
          />
        </label>

        <p className="text-muted -mb-1 text-xs leading-relaxed">
          Every song has to be <strong className="text-white">already released</strong>. We match
          it to a 30-second clip from Apple Music, and a song that hasn&apos;t reached the stores
          yet has nothing for us to play — so we&apos;ll turn it away rather than risk playing the
          wrong recording under your name. In Spotify: Share → Copy Song Link.
        </p>

        {songs.map((song, i) => (
          <div key={i} className="border-edge bg-surface/40 rounded-2xl border p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="motr-label">
                {songs.length > 1 ? `Song ${i + 1}` : "Spotify track link"}
              </span>
              {songs.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSongs(songs.filter((_, n) => n !== i))}
                  className="text-muted hover:text-nope text-xs underline underline-offset-2"
                >
                  Remove
                </button>
              )}
            </div>

            <input
              value={song.url}
              onChange={(e) => setSong(i, { url: e.target.value })}
              placeholder="https://open.spotify.com/track/..."
              className="border-edge bg-bg focus:border-gold w-full rounded-xl border px-4 py-3 outline-none transition placeholder:text-neutral-600"
            />

            <span className="text-muted mb-2 mt-3 block text-xs">
              Genre — decides which curators hear it if you break through.
            </span>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  type="button"
                  key={g}
                  aria-pressed={song.genre === g}
                  onClick={() => setSong(i, { genre: song.genre === g ? "" : g })}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    song.genre === g
                      ? "border-gold bg-gold text-bg font-semibold"
                      : "border-edge text-muted hover:border-gold/50 hover:text-white"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        ))}

        {songs.length < MAX_SONGS ? (
          <button
            type="button"
            onClick={() => setSongs([...songs, { url: "", genre: "" }])}
            className="border-edge hover:border-gold hover:text-gold rounded-full border border-dashed px-6 py-3 text-sm font-semibold transition"
          >
            + Add another song ({songs.length} of {MAX_SONGS})
          </button>
        ) : (
          <p className="text-muted text-center text-xs">
            {MAX_SONGS} songs is the most in one go. Send these, then you can add {MAX_SONGS} more.
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-gold text-bg rounded-full px-6 py-3.5 font-bold uppercase tracking-wide transition hover:brightness-110 disabled:opacity-30"
        >
          {pending
            ? progress
              ? `Checking ${progress.at} of ${progress.of}...`
              : "Submitting..."
            : filled.length > 1
              ? `Submit ${filled.length} songs`
              : "Submit to the feed"}
        </button>

        {pending && (
          <p className="text-muted text-center text-xs">
            Each song is matched to its Apple Music clip, which takes a few seconds. Don&apos;t
            close this.
          </p>
        )}

        {error && (
          <p className="border-nope/40 bg-nope/10 text-nope rounded-xl border p-3 text-sm">
            {error}
          </p>
        )}

        <p className="text-muted text-center text-xs leading-relaxed">
          Entering is free and always will be.{" "}
          <Link href="/faq" className="text-gold underline underline-offset-4">
            See how it works
          </Link>
        </p>
        <p className="text-muted text-center text-xs">
          Submitting means you agree to our{" "}
          <Link href="/terms" className="text-gold underline underline-offset-4">
            Terms
          </Link>
          , including that the fee buys consideration by curators — not a guaranteed placement.
        </p>
      </form>
    </main>
  );
}
