import PageNav from "@/components/PageNav";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service — MOTR",
  description: "The rules for fans, artists, and curators using MOTR.",
};

const EMAIL = "officialmusicontherox@gmail.com";
const UPDATED = "August 3, 2026";

/**
 * Written against what the product actually does — the artist fee buys
 * consideration rather than placement, curators are paid per verified share,
 * and neither promise is hedged here in a way the app doesn't honour.
 */
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "The short version",
    body: (
      <ul>
        <li>Fans swipe for free. Nothing is charged, ever.</li>
        <li>
          Artists pay a flat fee to put a fan-approved track in front of curators. That fee buys{" "}
          <strong className="text-white">consideration, not placement</strong>.
        </li>
        <li>Curators earn a flat fee for each share that stays up and checks out.</li>
        <li>Nobody can buy their way past the fan vote.</li>
      </ul>
    ),
  },
  {
    title: "Who can use MOTR",
    body: (
      <p>
        You need to be 13 or older to swipe. You need to be 18 or older to submit music or curate,
        because both involve money. Curating is open worldwide, but payouts are sent in US dollars
        through PayPal — so you need a PayPal account that can receive USD in your country. What
        PayPal allows differs from country to country, and that part is between you and them.
      </p>
    ),
  },
  {
    title: "For artists",
    body: (
      <>
        <p>
          A track only becomes eligible after it clears the fan vote. Once it does, you may pay the
          submission fee to send it to curators.
        </p>
        <ul>
          <li>
            <span className="text-white">What the fee buys:</span>{" "}
            your track is routed to five genre-matched curators who each listen and decide
            independently. That&apos;s it.
          </li>
          <li>
            <span className="text-white">What it does not buy:</span> a playlist add, a post, a
            review, coverage, streams, or any guaranteed outcome. Curators may all pass. That is a
            legitimate result, not a failure of the service.
          </li>
          <li>
            You must have the right to submit the track. Don&apos;t submit music you don&apos;t
            control.
          </li>
          <li>
            We may decline a submission before it reaches curators. If we do, you get a full
            refund.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Refunds",
    body: (
      <>
        <p>
          Stated plainly, because this is where services like ours usually get vague.
        </p>
        <ul>
          <li>
            <span className="text-white">Full refund</span> if we decline your submission, or if
            it never reaches curators.
          </li>
          <li>
            <span className="text-white">No refund</span> once curators have received and
            considered your track, even if all of them pass. Consideration by real people is what
            the fee pays for, and by then it has happened.
          </li>
        </ul>
        <p className="mt-2">
          Refund requests go to{" "}
          <a href={`mailto:${EMAIL}`} className="text-gold underline underline-offset-4">
            {EMAIL}
          </a>.
          We aim to respond within five business days.
        </p>
      </>
    ),
  },
  {
    title: "For curators",
    body: (
      <>
        <ul>
          <li>
            Applications are reviewed by hand. We check that your outlet is real and that the
            audience you claim is the audience you have. Misrepresenting either ends the
            relationship.
          </li>
          <li>
            You earn a flat fee per <span className="text-white">verified share</span> — a playlist
            add, a TikTok/Reel/Short, or a written piece, with proof.
          </li>
          <li>
            Playlist adds and video posts must stay up for at least four days. Pulling one early
            means it doesn&apos;t count.
          </li>
          <li>
            Passing on a track earns nothing, and passing is always a legitimate choice. You are
            never expected to feature anything you don&apos;t rate.
          </li>
          <li>
            Earnings clear seven days after verification. Cash out at $50 or more, less a flat $2
            transfer fee. Payouts are in US dollars through PayPal, wherever you are.
          </li>
          <li>
            <span className="text-white">You&apos;re independent, not employed by us.</span> You
            choose what you feature, when you work, and for whom else you work. Nothing here makes
            you an employee, partner or agent of MOTR.
          </li>
          <li>
            <span className="text-white">Don&apos;t game it.</span> Fake placements, bought
            followers, playlists nobody listens to, or shares posted only to collect the fee mean
            forfeited earnings and removal.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "For fans",
    body: (
      <>
        <p>
          Swipe honestly. Automated swiping, multiple accounts, or any attempt to push a
          particular track through the vote undermines the one part of MOTR that money
          can&apos;t touch — we&apos;ll remove accounts that do it and discount their votes.
        </p>
        <p className="mt-3">
          Votes are weighted by attention. If you listen to a clip all the way through before
          deciding, your verdict counts double — and that applies whether you swipe left or
          right, so it rewards listening rather than approving. Everyone else&apos;s vote still
          counts in full.
        </p>
        <p className="mt-3">
          <span className="text-white">If you sign in, we may email you.</span> That means things
          like a reminder when you haven&apos;t swiped in a while, or news about tracks you
          saved — not adverts for anyone else. Every one carries an unsubscribe link and a single
          click ends them permanently, without touching your account or your saves. Swipe without
          an account and we have no address for you, so there&apos;s nothing to opt out of.
        </p>
      </>
    ),
  },
  {
    title: "Music and content",
    body: (
      <p>
        Clips are 30-second previews supplied by third-party catalogue services. Artists and rights
        holders keep everything they own; we claim no rights in your music beyond showing the
        preview inside MOTR. If you hold rights to something here and want it removed, email us and
        we&apos;ll take it down.
      </p>
    ),
  },
  {
    title: "Payments",
    body: (
      <p>
        Artist fees are processed by Stripe; card details never reach our servers. Curator payouts
        go out through PayPal after a cashout request. Everything — prices, balances and payouts —
        is in US dollars, wherever you are. If your PayPal account holds another currency, PayPal
        converts the payment at their own rate when it arrives, and that rate is theirs, not ours.
        We may change pricing, but never for a submission already paid for.
      </p>
    ),
  },
  {
    title: "Taxes",
    body: (
      <>
        <p>
          <span className="text-white">We don&apos;t withhold or deduct tax from anything we
          pay you.</span> Every curator payout is gross: what leaves us is what you earned, less
          only the transfer fee we&apos;ve already told you about.
        </p>
        <p className="mt-3">
          Whatever you owe on that income, and to whom, is between you and the tax authority
          where you live — not between you and MOTR. Declaring it is your responsibility, and it
          stays your responsibility whichever country you curate from. If you&apos;re unsure what
          applies to you, ask someone qualified where you are; we can&apos;t advise you on it and
          nothing here is tax advice.
        </p>
        <p className="mt-3">
          PayPal may send you their own records or tax forms depending on your country and how
          much you receive. Those come from PayPal, under their rules, and any question about
          them is for PayPal — we don&apos;t issue them and can&apos;t change them.
        </p>
        <p className="mt-3">
          If the law ever requires us to collect tax details from you, or to report what
          we&apos;ve paid you, we&apos;ll ask for exactly what&apos;s needed and tell you why.
          Payouts can be held until that information is provided, because we&apos;re not able to
          pay in breach of it.
        </p>
      </>
    ),
  },
  {
    title: "Ending things",
    body: (
      <p>
        You can stop using MOTR whenever you like and ask us to delete your account — see the{" "}
        <Link href="/privacy" className="text-gold underline underline-offset-4">
          Privacy Policy
        </Link>.
        We may suspend an account for the abuses described above, or where the law requires
        it. If we close a curator account without cause, any verified earnings you&apos;ve already
        cleared still get paid.
      </p>
    ),
  },
  {
    title: "The legal bit",
    body: (
      <p>
        MOTR is provided as-is. We don&apos;t promise it will be uninterrupted or error-free, and
        we&apos;re not liable for indirect losses — including career outcomes that did or
        didn&apos;t follow from using it. Nothing here limits liability we can&apos;t limit by law,
        including for fraud. These terms are governed by the laws of the United States and the
        state in which MOTR operates. If we change them materially, we&apos;ll tell you before the
        change takes effect.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <main className="bg-bg min-h-screen pb-20">
      <PageNav />

      <header className="border-edge border-b px-6 py-10 text-center">
        <Link href="/" aria-label="MOTR home" className="inline-block">
          <Image
            src="/motr-logo.png"
            alt="MOTR"
            width={1000}
            height={550}
            className="mx-auto h-12 w-auto"
          />
        </Link>
        <h1 className="font-display mt-6 text-4xl uppercase tracking-wide">Terms of Service</h1>
        <p className="text-muted mt-2 text-xs uppercase tracking-widest">Last updated {UPDATED}</p>
      </header>

      <div className="mx-auto mt-10 max-w-2xl px-6">
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title} className="border-edge bg-surface rounded-2xl border p-6">
              <h2 className="font-display text-gold text-xl uppercase tracking-wide">{s.title}</h2>
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
            href="/privacy"
            className="border-edge hover:border-gold rounded-full border px-6 py-3 text-sm font-semibold transition"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}
