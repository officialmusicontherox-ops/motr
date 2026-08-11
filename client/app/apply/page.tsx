"use client";

import PageNav from "@/components/PageNav";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Crown } from "@/components/icons";
import { GENRES, OUTLET_TYPES } from "@/lib/genres";

export default function ApplyPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  // Once they've typed their own, the outlet name stops overwriting it.
  const usernameEdited = useRef(false);
  const [outletName, setOutletName] = useState("");
  const [outletType, setOutletType] = useState("");
  const [outletUrl, setOutletUrl] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [socials, setSocials] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [pitch, setPitch] = useState("");
  const [country, setCountry] = useState("");
  const [paypalOk, setPaypalOk] = useState(false);
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
        country: country.trim(),
        paypalOk,
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
    country.trim().length > 1 &&
    paypalOk;

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
          Open worldwide. You need a PayPal account that can receive USD — earnings are tracked
          and paid in US dollars wherever you are.
        </p>
        {/* Says how long it takes. People abandon a form because they can't
            see the end of it, not because any one field was hard. */}
        <p className="text-muted mx-auto mt-2 max-w-md text-xs">
          Seven questions, about a minute. You only ever fill this in once.
        </p>
      </header>

      <form onSubmit={submit} className="mx-auto mt-8 flex max-w-lg flex-col gap-6 px-6">
        <Section title="Your outlet" hint="This is what we actually check.">
          <Field label="Outlet name" required>
            <input
              value={outletName}
              onChange={(e) => {
                setOutletName(e.target.value);
                // Most people want their outlet's name here anyway, so filling
                // it in removes a field's worth of thinking. Still editable —
                // typing in it takes over for good.
                if (!usernameEdited.current) {
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
                  );
                }
              }}
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

          {/* Marked optional outright. Unlabelled, they read as more required
              work and make the form look twice as long as it is. */}
          <Field label="Audience size" optional hint="Followers, subscribers or monthly listeners.">
            <input
              inputMode="numeric"
              value={audienceSize}
              onChange={(e) => setAudienceSize(e.target.value)}
              placeholder="e.g. 12000"
              className={inputCls}
            />
          </Field>

          <Field label="Socials" optional hint="One per line. Helps us confirm you're real.">
            <textarea
              value={socials}
              onChange={(e) => setSocials(e.target.value)}
              rows={2}
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

          <Field label="Username" required hint="Filled in from your outlet — change it if you'd rather.">
            <input
              value={username}
              onChange={(e) => {
                usernameEdited.current = true;
                setUsername(e.target.value);
              }}
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

          {/* Kept, because it's what the application is actually judged on —
              but asked in a way that can be answered in one line instead of
              reading like an essay question. */}
          <Field label="Why you" required hint="A sentence is plenty.">
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              required
              rows={2}
              placeholder="e.g. I run a 4k-follower indie playlist and add 5–10 new tracks every Friday."
              className={inputCls}
            />
          </Field>

          <Field label="Country" required hint="Where you're paid from PayPal's point of view.">
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              placeholder="e.g. United States, Canada, Germany"
              className={inputCls}
            />
          </Field>

          {/* PayPal reaches 190+ countries but the rules differ everywhere —
              some can receive USD but not withdraw it locally, and a few are
              blocked outright. Rather than maintain that list, the curator
              confirms their own account can take a USD payment; PayPal is the
              one that actually knows, and it fails the payout if it can't. */}
          <label className="border-edge bg-bg flex cursor-pointer items-start gap-3 rounded-xl border p-3">
            <input
              type="checkbox"
              checked={paypalOk}
              onChange={(e) => setPaypalOk(e.target.checked)}
              className="accent-gold mt-0.5 h-4 w-4 shrink-0"
            />
            <span className="text-sm">
              I have a PayPal account that can receive payments in USD.
              <span className="text-muted mt-0.5 block text-xs">
                Earnings are tracked and paid in US dollars wherever you are. If your PayPal
                holds another currency, PayPal converts it at their rate when it lands.
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
  optional,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  /** Says so plainly, so the field doesn't read as more work to do. */
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold">
        {label}
        {required && <span className="text-gold"> *</span>}
        {optional && <span className="text-muted font-normal"> · optional</span>}
      </span>
      {hint && <span className="text-muted mb-2 mt-0.5 block text-xs">{hint}</span>}
      <span className={hint ? "block" : "mt-2 block"}>{children}</span>
    </label>
  );
}
