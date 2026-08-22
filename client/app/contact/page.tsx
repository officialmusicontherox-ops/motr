import PageNav from "@/components/PageNav";
import Image from "next/image";
import Link from "next/link";
import { ArrowOut, Crown } from "@/components/icons";

export const metadata = {
  title: "Contact — MOTR",
  description: "Get in touch with the MOTR team.",
};

const EMAIL = "officialmusicontherox@gmail.com";

const TOPICS = [
  "Something looks broken",
  "A question about your submission",
  "Curator applications and payouts",
  "Press, partnerships, or anything else",
];

export default function ContactPage() {
  return (
    <main className="bg-bg min-h-screen pb-24">
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
        <h1 className="font-display mt-6 text-4xl uppercase tracking-wide">Get in touch</h1>
        <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
          One inbox, read by a real person. Artists, curators, fans — all welcome.
        </p>
      </header>

      <section className="mx-auto max-w-lg px-6 py-10">
        <a
          href={`mailto:${EMAIL}`}
          className="border-gold/40 bg-surface hover:border-gold block rounded-2xl border p-6 text-center transition"
        >
          <Crown className="text-gold mx-auto h-6 w-6" />
          <span className="motr-label mt-3 block">Email us</span>
          <span className="text-gold mt-1 block break-all text-lg font-semibold">{EMAIL}</span>
        </a>

        <div className="mt-8">
          <h2 className="motr-label">What people write in about</h2>
          <ul className="mt-3 space-y-2">
            {TOPICS.map((t) => (
              <li
                key={t}
                className="border-edge bg-surface text-muted flex items-center gap-3 rounded-xl border p-3.5 text-sm"
              >
                <Crown className="text-gold/50 h-3.5 w-3.5 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <a
          href="https://musicontherox.com"
          target="_blank"
          rel="noreferrer"
          className="border-edge bg-surface hover:border-gold/50 mt-8 flex items-center justify-between gap-3 rounded-2xl border p-5 transition"
        >
          <span className="min-w-0">
            <span className="text-gold block font-semibold">MusicOnTheRox.com</span>
            <span className="text-muted mt-1 block text-xs">
              Shows, features, and everything else we do.
            </span>
          </span>
          <ArrowOut className="text-muted h-5 w-5 shrink-0" />
        </a>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/faq"
            className="border-edge hover:border-gold rounded-full border px-6 py-3 text-sm font-semibold transition"
          >
            Read the FAQ
          </Link>
          <Link
            href="/"
            className="bg-gold text-bg rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide"
          >
            Start swiping
          </Link>
        </div>
      </section>
    </main>
  );
}
