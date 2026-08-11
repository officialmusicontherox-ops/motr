import PageNav from "@/components/PageNav";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — MOTR",
  description: "What MOTR collects, why, who it's shared with, and how to get it deleted.",
};

const EMAIL = "officialmusicontherox@gmail.com";
const UPDATED = "August 3, 2026";

/**
 * Written around what the app actually stores rather than a generic template —
 * every collection item below maps to a real field in the schema, so this
 * needs revisiting whenever the data model grows.
 */
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Who we are",
    body: (
      <p>
        MOTR (Music On The Rox) is a music discovery service operated from the United States.
        This policy covers the MOTR app and the pages under musicontherox.com. Questions go to{" "}
        <a href={`mailto:${EMAIL}`} className="text-gold underline underline-offset-4">
          {EMAIL}
        </a>.
              </p>
    ),
  },
  {
    title: "What we collect",
    body: (
      <>
        <p className="font-semibold text-white">If you swipe anonymously</p>
        <ul>
          <li>A randomly generated username and account ID. No email, no name.</li>
          <li>Which tracks you swiped on, which direction, and when.</li>
        </ul>

        <p className="mt-4 font-semibold text-white">If you sign in with Google</p>
        <ul>
          <li>Your email address and the name on your Google account.</li>
          <li>Your swipe history and saved tracks.</li>
        </ul>
        <p className="mt-2">
          Signing in is only so your saves survive a cleared browser and follow you to another
          device. We ask Google for nothing beyond your name and email, and we never post anywhere
          on your behalf.
        </p>

        <p className="mt-4 font-semibold text-white">If you apply to curate</p>
        <ul>
          <li>Your email, chosen username, and country.</li>
          <li>
            Your outlet name, type, link, audience size, social links, genres, and the pitch you
            write. This is the substance we review, so please only submit what you&apos;re happy
            for us to check.
          </li>
          <li>
            Your payout address (e.g. a PayPal email) and a record of what you earned and cashed
            out.
          </li>
        </ul>

        <p className="mt-4 font-semibold text-white">If you submit music as an artist</p>
        <ul>
          <li>Your name, email, and the track you submitted.</li>
          <li>
            Payment records — the amount, the date, and Stripe&apos;s reference IDs. We never see
            or store your full card number.
          </li>
        </ul>

        <p className="mt-4 font-semibold text-white">Automatically</p>
        <ul>
          <li>
            Standard server logs (IP address, browser type, pages requested) kept briefly for
            security and debugging.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Why we collect it",
    body: (
      <ul>
        <li>To run the feed and make sure you never see the same track twice.</li>
        <li>To count swipes and decide which tracks break through.</li>
        <li>To keep your saves attached to you rather than to one browser.</li>
        <li>To review curator applications and route tracks by genre.</li>
        <li>To take artist payments and pay curators what they&apos;ve earned.</li>
        <li>
          To email you about things that concern you — an application decision, a track breaking
          through, a cashout.
        </li>
        <li>To detect fraud and abuse, and to meet our tax and accounting obligations.</li>
      </ul>
    ),
  },
  {
    title: "We don't sell your data",
    body: (
      <p>
        We do not sell or rent your personal information, and we don&apos;t share it with
        advertisers or data brokers. Artists and curators see a track&apos;s swipe totals, never
        who swiped.
      </p>
    ),
  },
  {
    title: "Who we share it with",
    body: (
      <>
        <p>Only the services needed to run MOTR, and only what each one needs:</p>
        <ul>
          <li>
            <span className="text-white">Google</span> — sign-in. We receive your name and email;
            Google is told nothing about what you listen to.
          </li>
          <li>
            <span className="text-white">Stripe</span> — artist payments. Stripe handles card
            details directly under its own privacy policy.
          </li>
          <li>
            <span className="text-white">PayPal</span> — curator cashouts.
          </li>
          <li>
            <span className="text-white">Resend</span> — transactional email.
          </li>
          <li>
            <span className="text-white">Neon and Vercel</span> — database and hosting.
          </li>
          <li>
            <span className="text-white">Apple and Deezer</span> — track previews and artwork.
            These are lookups we make about music, not a handover of anything about you.
          </li>
        </ul>
        <p className="mt-2">
          The Spotify buttons on your saved tracks are ordinary links. Tapping one opens Spotify
          with that song; nothing about you is sent to them, and MOTR has no access to your
          Spotify account.
        </p>
        <ul>
        </ul>
        <p className="mt-2">
          We may also disclose information if the law requires it, or to protect the rights and
          safety of MOTR and its users.
        </p>
      </>
    ),
  },
  {
    title: "Cookies",
    body: (
      <p>
        We use a small number of first-party cookies to keep you signed in and to hold your
        session while you sign in with Google. There are no advertising or
        cross-site tracking cookies on MOTR. Blocking cookies will break sign-in.
      </p>
    ),
  },
  {
    title: "How long we keep it",
    body: (
      <ul>
        <li>Swipes and saved tracks: as long as your account exists.</li>
        <li>
          Curator applications: kept while under review and for a reasonable period after, so we
          have a record of decisions.
        </li>
        <li>
          Payment and payout records: kept as long as tax and accounting rules require, typically
          seven years, even after an account closes.
        </li>
        <li>Server logs: a short rolling window.</li>
      </ul>
    ),
  },
  {
    title: "Your choices",
    body: (
      <>
        <ul>
          <li>
            <span className="text-white">Ask for a copy</span> of what we hold about you, or ask
            us to correct it.
          </li>
          <li>
            <span className="text-white">Ask us to delete your account.</span>{" "}
            We&apos;ll remove your profile and sign-in data. Anonymised swipe counts stay in a track&apos;s totals,
            and financial records we&apos;re required to keep will remain.
          </li>
          <li>
            <span className="text-white">Unsubscribe</span> from any non-essential email using the
            link in it.
          </li>
        </ul>
        <p className="mt-2">
          Email{" "}
          <a href={`mailto:${EMAIL}`} className="text-gold underline underline-offset-4">
            {EMAIL}
          </a>{" "}
          for any of the above and we&apos;ll respond within 30 days. We won&apos;t treat you
          differently for exercising these rights.
        </p>
      </>
    ),
  },
  {
    title: "California and other US state rights",
    body: (
      <p>
        If you live in California, Colorado, Connecticut, Virginia, or another state with a
        comparable privacy law, you have the right to know what we collect, to request deletion,
        to correct inaccurate information, and to opt out of sale or targeted advertising. We
        don&apos;t sell personal information or run targeted advertising, so there&apos;s nothing
        to opt out of — but the other rights apply, and the email above is how to use them.
      </p>
    ),
  },
  {
    title: "If you're outside the US",
    body: (
      <p>
        MOTR is operated in the United States and your information is stored and processed there.
        Curating is open worldwide — if you apply, the country you give us and your PayPal address
        are used to pay you, and shared with PayPal for that purpose. If you&apos;re in the UK or
        EU, you may have additional rights over your data under UK GDPR or GDPR — email us and
        we&apos;ll honour them.
      </p>
    ),
  },
  {
    title: "Age",
    body: (
      <p>
        MOTR isn&apos;t for children under 13, and we don&apos;t knowingly collect anything from
        them. Submitting music or curating requires you to be 18 or older, because it involves
        payments. If you believe a child has given us information, email us and we&apos;ll delete
        it.
      </p>
    ),
  },
  {
    title: "Security",
    body: (
      <p>
        Traffic is encrypted in transit, sign-in tokens are stored server-side, admin accounts
        require two-factor authentication, and card details never touch our servers. No system is
        perfectly secure, but if a breach ever affects your information we&apos;ll tell you
        promptly.
      </p>
    ),
  },
  {
    title: "Changes",
    body: (
      <p>
        If we change this policy we&apos;ll update the date at the top of the page, and for
        anything significant we&apos;ll tell you in the app or by email before it takes effect.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="bg-bg min-h-screen pb-20">
      <PageNav />

      <header className="border-edge border-b px-6 py-10 text-center">
        <Link href="/" aria-label="MOTR home" className="inline-block">
          <Image
            src="/motr-logo.png"
            alt="MOTR"
            width={325}
            height={145}
            className="mx-auto h-12 w-auto"
          />
        </Link>
        <h1 className="font-display mt-6 text-4xl uppercase tracking-wide">Privacy Policy</h1>
        <p className="text-muted mt-2 text-xs uppercase tracking-widest">
          Last updated {UPDATED}
        </p>
        <p className="text-muted mx-auto mt-4 max-w-md text-sm leading-relaxed">
          The short version: we collect what it takes to run the feed, pay people, and put a track
          in your library when you ask. We don&apos;t sell any of it.
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-2xl px-6">
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title} className="border-edge bg-surface rounded-2xl border p-6">
              <h2 className="font-display text-gold text-xl uppercase tracking-wide">
                {s.title}
              </h2>
              {/* Shared prose styling so each section body can stay plain JSX. */}
              <div className="text-muted mt-3 space-y-2 text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_ul]:mt-2 [&_ul]:space-y-1.5">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="bg-gold text-bg rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide"
          >
            Back to the feed
          </Link>
          <Link
            href="/terms"
            className="border-edge hover:border-gold rounded-full border px-6 py-3 text-sm font-semibold transition"
          >
            Terms
          </Link>
          <Link
            href="/contact"
            className="border-edge hover:border-gold rounded-full border px-6 py-3 text-sm font-semibold transition"
          >
            Contact us
          </Link>
        </div>
      </div>
    </main>
  );
}
