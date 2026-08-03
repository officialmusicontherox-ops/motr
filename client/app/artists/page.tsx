"use client";

import PageNav from "@/components/PageNav";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Crown } from "@/components/icons";
import { GENRES } from "@/lib/genres";

export default function ArtistsPage() {
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [artistEmail, setArtistEmail] = useState("");
  const [genre, setGenre] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ title: string; artistName: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/tracks/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "SPOTIFY", spotifyUrl, artistEmail, genre }),
    });
    const data = await res.json();
    setPending(false);

    if (!res.ok) {
      setError(data.error ?? "Could not submit that track");
      return;
    }
    if (data.alreadyExisted) {
      setError("That track is already in the feed.");
      return;
    }
    setDone({ title: data.track.title, artistName: data.track.artistName });
  }

  if (done) {
    return (
      <main className="bg-bg min-h-screen">
        <PageNav />
        <div className="flex min-h-[75vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Crown className="text-gold h-12 w-12" />
        <h1 className="font-display text-3xl uppercase tracking-wide">You&apos;re in the feed</h1>
        <p className="text-muted max-w-sm text-sm leading-relaxed">
          <span className="text-white">{done.title}</span> by{" "}
          <span className="text-white">{done.artistName}</span> is live for fans to swipe on. If
          enough of them back it, we&apos;ll email you about the curator round.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setDone(null);
              setSpotifyUrl("");
            }}
            className="border-edge hover:border-gold rounded-full border px-6 py-3 text-sm font-semibold transition"
          >
            Submit another
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
            width={325}
            height={145}
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
        <label className="block">
          <span className="motr-label block">Spotify track link</span>
          <span className="text-muted mb-2 mt-1 block text-xs">
            Open your song in Spotify → Share → Copy Song Link.
          </span>
          <input
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
            required
            placeholder="https://open.spotify.com/track/..."
            className="border-edge bg-surface focus:border-gold w-full rounded-xl border px-4 py-3 outline-none transition placeholder:text-neutral-600"
          />
        </label>

        <label className="block">
          <span className="motr-label block">Your email</span>
          <span className="text-muted mb-2 mt-1 block text-xs">
            Where we tell you if fans push it through.
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

        <div>
          <span className="motr-label block">Genre</span>
          <span className="text-muted mb-2 mt-1 block text-xs">
            Decides which curators hear it if you break through.
          </span>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button
                type="button"
                key={g}
                aria-pressed={genre === g}
                onClick={() => setGenre(genre === g ? "" : g)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  genre === g
                    ? "border-gold bg-gold text-bg font-semibold"
                    : "border-edge text-muted hover:border-gold/50 hover:text-white"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={pending || !spotifyUrl.trim() || !genre}
          className="bg-gold text-bg rounded-full px-6 py-3.5 font-bold uppercase tracking-wide transition hover:brightness-110 disabled:opacity-30"
        >
          {pending ? "Submitting..." : "Submit to the feed"}
        </button>

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
