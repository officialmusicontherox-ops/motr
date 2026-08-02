"use client";

import PageNav from "@/components/PageNav";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Crown } from "@/components/icons";
import { GENRES, OUTLET_TYPES } from "@/lib/genres";

export default function ApplyPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [outletName, setOutletName] = useState("");
  const [outletType, setOutletType] = useState("");
  const [outletUrl, setOutletUrl] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [socials, setSocials] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [pitch, setPitch] = useState("");
  const [inUs, setInUs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/curator-applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        username,
        outletName,
        outletType,
        outletUrl,
        audienceSize: audienceSize ? Number(audienceSize.replace(/[^0-9]/g, "")) : null,
        socialLinks: socials
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        genres,
        pitch,
        country: inUs ? "US" : "",
      }),
    });
    setPending(false);

    if (!res.ok) {
      setError((await res.json()).error ?? "Could not submit your application");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="bg-bg min-h-screen">
        <PageNav />
        <div className="flex min-h-[75vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <Crown className="text-gold h-12 w-12" />
          <h1 className="font-display text-3xl uppercase tracking-wide">Application in</h1>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            We check every outlet by hand. If it&apos;s a fit you&apos;ll hear from us, and
            tracks start landing in your queue.
          </p>
          <Link
            href="/"
            className="border-edge hover:border-gold mt-2 rounded-full border px-6 py-3 text-sm font-semibold transition"
          >
            Back to the feed
          </Link>
        </div>
      </main>
    );
  }

  const ready =
    email.trim() &&
    username.trim() &&
    outletName.trim() &&
    outletType &&
    outletUrl.trim() &&
    genres.length > 0 &&
    pitch.trim().length >= 20 &&
    inUs;

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
        <h1 className="font-display mt-6 text-4xl uppercase tracking-wide">Apply to curate</h1>
        <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
          Curators and influencers get a genre-matched queue of fan-approved tracks and a flat fee
          per share that sticks — playlist, TikTok/Reel/Short, or write-up. We vet every outlet by
          hand, so tell us what you run.
        </p>
        <p className="text-gold/80 mx-auto mt-3 max-w-md text-xs">
          US-based curators only for now — payouts go out through PayPal US.
        </p>
      </header>

      <form onSubmit={submit} className="mx-auto mt-8 flex max-w-lg flex-col gap-6 px-6">
        <Section title="Your outlet" hint="This is what we actually check.">
          <Field label="Outlet name" required>
            <input
              value={outletName}
              onChange={(e) => setOutletName(e.target.value)}
              required
              placeholder="e.g. Basement Tapes Weekly"
              className={inputCls}
            />
          </Field>

          <Field label="What kind" required>
            <div className="flex flex-wrap gap-2">
              {OUTLET_TYPES.map((t) => (
                <button
                  type="button"
                  key={t}
                  aria-pressed={outletType === t}
                  onClick={() => setOutletType(outletType === t ? "" : t)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    outletType === t
                      ? "border-gold bg-gold text-bg font-semibold"
                      : "border-edge text-muted hover:border-gold/50 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Link to it" required hint="Playlist, publication, channel — wherever the work lives.">
            <input
              type="url"
              value={outletUrl}
              onChange={(e) => setOutletUrl(e.target.value)}
              required
              placeholder="https://"
              className={inputCls}
            />
          </Field>

          <Field label="Audience size" hint="Followers, subscribers, or monthly listeners. Be honest — we look.">
            <input
              inputMode="numeric"
              value={audienceSize}
              onChange={(e) => setAudienceSize(e.target.value)}
              placeholder="e.g. 12000"
              className={inputCls}
            />
          </Field>

          <Field label="Socials" hint="One per line. Helps us confirm you're real.">
            <textarea
              value={socials}
              onChange={(e) => setSocials(e.target.value)}
              rows={3}
              placeholder={"https://instagram.com/…\nhttps://x.com/…"}
              className={inputCls}
            />
          </Field>
        </Section>

        <Section title="You">
          <Field label="Email" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className={inputCls}
            />
          </Field>

          <Field label="Username" required hint="What fans see next to your picks.">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="basementtapes"
              className={inputCls}
            />
          </Field>

          <Field label="Genres you cover" required hint="Tracks route to curators by genre.">
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const on = genres.includes(g);
                return (
                  <button
                    type="button"
                    key={g}
                    aria-pressed={on}
                    onClick={() => setGenres(on ? genres.filter((x) => x !== g) : [...genres, g])}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      on
                        ? "border-gold bg-gold text-bg font-semibold"
                        : "border-edge text-muted hover:border-gold/50 hover:text-white"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Why you" required hint="How you pick, and how often you post.">
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              required
              rows={4}
              placeholder="Tell us how you find music and what you've broken…"
              className={inputCls}
            />
          </Field>

          {/* US-only is a payout constraint, so it's confirmed on the form
              rather than inferred later from a payout address. */}
          <label className="border-edge bg-bg flex cursor-pointer items-start gap-3 rounded-xl border p-3">
            <input
              type="checkbox"
              checked={inUs}
              onChange={(e) => setInUs(e.target.checked)}
              className="accent-gold mt-0.5 h-4 w-4 shrink-0"
            />
            <span className="text-sm">
              I&apos;m based in the United States and can receive payouts in USD.
              <span className="text-muted mt-0.5 block text-xs">
                We&apos;re US-only while payouts run through PayPal US.
              </span>
            </span>
          </label>
        </Section>

        <button
          type="submit"
          disabled={pending || !ready}
          className="bg-gold text-bg rounded-full px-6 py-3.5 font-bold uppercase tracking-wide transition hover:brightness-110 disabled:opacity-30"
        >
          {pending ? "Sending..." : "Apply"}
        </button>

        {error && (
          <p className="border-nope/40 bg-nope/10 text-nope rounded-xl border p-3 text-sm">
            {error}
          </p>
        )}

        <p className="text-muted text-center text-xs">

          By applying you agree to our{" "}

          <Link href="/privacy" className="text-gold underline underline-offset-4">

            Privacy Policy

          </Link>

          .

        </p>


        <p className="text-muted text-center text-xs">
          Curious how the money works?{" "}
          <Link href="/faq" className="text-gold underline underline-offset-4">
            Read the FAQ
          </Link>
        </p>
      </form>
    </main>
  );
}

const inputCls =
  "border-edge bg-surface focus:border-gold w-full rounded-xl border px-4 py-3 outline-none transition placeholder:text-neutral-600";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-edge bg-surface/40 rounded-2xl border p-5">
      <legend className="motr-label px-2">{title}</legend>
      {hint && <p className="text-muted -mt-1 mb-4 text-xs">{hint}</p>}
      <div className="flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold">
        {label}
        {required && <span className="text-gold"> *</span>}
      </span>
      {hint && <span className="text-muted mb-2 mt-0.5 block text-xs">{hint}</span>}
      <span className={hint ? "block" : "mt-2 block"}>{children}</span>
    </label>
  );
}
