import PageNav from "@/components/PageNav";
import { SLOTS, SPOTLIGHT_SPAN } from "@/lib/spotlightBundles";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service — MOTR",
  description: "The rules for the listeners and artists using MOTR."
};

const EMAIL = "officialmusicontherox@gmail.com";
const UPDATED = "November 12, 2026";

/**
 * Written against what the product actually does.
 *
 * MOTR is free to use. Artists are never charged and listening costs
 * nothing. The curator programme, the submission fee and the payouts that
 * went with them were retired, and the sections covering them were removed
 * rather than left standing as terms for something that no longer exists.
 *
 * The single exception is a Spotlight, which a listener may buy to promote
 * an artist. It is promotion and nothing else: it cannot touch the chart,
 * which is why these terms can still promise the vote is unbuyable.
 */
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "The short version",
    body: (
      <ul>
        <li>MOTR is free to use. No artist is ever charged anything.</li>
        <li>Artists submit music for free, and it stays in the feed for free.</li>
        <li>
          The one thing anyone can buy is a{" "}
          <strong className="text-ink">Spotlight</strong>, which a listener may buy to put an
          artist on the Spotlight tab. It is advertising, it is{" "}
          <strong className="text-ink">non-refundable</strong>, and it cannot affect the chart.
        </li>
        <li>
          Every track is heard with{" "}
          <strong className="text-ink">no artist name attached</strong>, so what comes back is a
          verdict on the song.
        </li>
        <li>
          Nobody can buy their way onto the chart. A Spotlight buys a place on its own tab and
          nothing else.
        </li>
      </ul>
    ),
  },
  {
    title: "Who can use MOTR",
    body: (
      <p>
        You need to be 13 or older to swipe, and 18 or older to submit music, because submitting
        means telling us you hold the rights to it. MOTR is open worldwide and free everywhere.
      </p>
    ),
  },
  {
    title: "For artists",
    body: (
      <>
        <p>
          Submitting is free, and an artist is never asked to pay for anything, including a
          Spotlight. Only a listener can buy one, and only for somebody else.
        </p>
        <ul>
          <li>
            <span className="text-ink">What you get:</span> your track goes into the feed and is
            played with no artist name attached, so the response is to
            the music itself.
          </li>
          <li>
            <span className="text-ink">What we don&apos;t promise:</span> a particular number of
            plays, a good reception, or any outcome at all. Listeners may pass on it. That is a
            legitimate result, not a failure of the service.
          </li>
          <li>
            You must have the right to submit the track. Don&apos;t submit music you don&apos;t
            control.
          </li>
          <li>
            We may decline or remove a submission. If we do, we&apos;ll tell you why.
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
          can&apos;t touch. We remove accounts that do it and discount their votes.
        </p>
        <p className="mt-3">
          Votes are weighted by attention. If you listen to a clip all the way through before
          deciding, your verdict counts double, and that applies whether you swipe left or
          right, so it rewards listening rather than approving. Everyone else&apos;s vote still
          counts in full.
        </p>
        <p className="mt-3">
          <span className="text-ink">If you sign in, we may email you.</span> That means things
          like a reminder when you haven&apos;t swiped in a while, or news about tracks you
          saved, not adverts for anyone else. Every one carries an unsubscribe link that ends them
          permanently. For a listener that changes nothing else: your account and your saves stay
          as they are. For an artist it does more, because email is the only way we can reach you
          about the charts, the weekly contest or your own release, so unsubscribing also takes
          your music off the platform. We ask you to confirm that before it happens, nothing is
          deleted, and submitting again puts you back on with your music. Swipe without an account
          and we have no address for you, so there&apos;s nothing to opt out of.
        </p>
      </>
    ),
  },
  {
    title: "Music and content",
    body: (
      <p>
        Clips are 30-second previews supplied by third-party catalog services. Artists and rights
        holders keep everything they own; we claim no rights in your music beyond showing the
        preview inside MOTR. Previews come from third-party catalogs, so a track can stop
        playing or disappear if that catalog changes or withdraws it, which is outside our
        control.
      </p>
    ),
  },
  {
    title: "Copyright complaints and takedowns",
    body: (
      <>
        <p>
          If you hold rights to something on MOTR and want it removed, email{" "}
          <a href={`mailto:${EMAIL}`} className="text-gold underline underline-offset-4">
            {EMAIL}
          </a>{" "}
          with the subject line <span className="text-ink">Copyright notice</span>. We act on
          these quickly and we do not require a lawyer to be involved.
        </p>
        <p className="mt-3">Please include:</p>
        <ul>
          <li>What the work is, and a link to it on MOTR.</li>
          <li>Proof you own it or act for the owner.</li>
          <li>Your name, address and a contact email.</li>
          <li>
            A statement that you believe in good faith the use is not authorised, and that the
            information in your notice is accurate.
          </li>
        </ul>
        <p className="mt-3">
          If we remove something of yours and you believe that was wrong, reply to us and say
          why. We will put it back if the claim does not hold up. Repeatedly submitting music
          you have no rights to will end your access.
        </p>

        {/* Section 512(c)(2) requires substantially this information to be
            public on the site, not only in the Copyright Office directory.
            If any of it changes, amend the registration too: the two
            disagreeing is the first thing a rightsholder's lawyer points at. */}
        <p className="mt-6 font-semibold text-ink">Designated copyright agent</p>
        <p className="mt-2">
          Registered with the United States Copyright Office, registration{" "}
          <span className="text-ink">DMCA-1082285</span>.
        </p>
        <address className="mt-2 not-italic leading-relaxed">
          Copyright Agent
          <br />
          Music On The Rox
          <br />
          6339 Charlotte Pike, Unit #D456
          <br />
          Nashville, TN 37209
          <br />
          <a href="tel:+17205206252" className="text-gold underline underline-offset-4">
            (720) 520-6252
          </a>
          <br />
          <a href={`mailto:${EMAIL}`} className="text-gold underline underline-offset-4">
            {EMAIL}
          </a>
        </address>
      </>
    ),
  },
  {
    title: "Spotlights",
    body: (
      <>
        <p>
          A <strong className="text-ink">Spotlight</strong> is the only thing MOTR sells. A
          listener buys one and spends it on an artist they like, and that artist appears on the
          Spotlight tab, named, with their photo and links to Spotify and Apple Music.
        </p>
        <ul>
          <li>
            <strong className="text-ink">It runs for {SPOTLIGHT_SPAN}.</strong> There are{" "}
            {SLOTS} places on the tab. If all of them are taken when you buy, yours waits in line
            and its {SPOTLIGHT_SPAN} start when a place frees, so you never lose time you paid
            for.
          </li>
          <li>
            <strong className="text-ink">It is promotion, not a vote.</strong> A Spotlight has no
            effect on the charts, on the weekly winner, or on any figure an artist is judged by.
            Those come only from blind listening, where nobody knows whose song is playing. This
            is deliberate and it is the reason a Spotlight can be sold at all.
          </li>
          <li>
            <strong className="text-ink">Purchases are non-refundable.</strong> Spotlights are
            delivered immediately as credit on your account and are consumed the moment you spend
            one, so we do not offer refunds, exchanges or transfers, and unspent Spotlights have
            no cash value. This does not affect rights you have under the law where you live.
          </li>
          <li>
            <strong className="text-ink">No artist is ever required to pay.</strong> Submitting
            music and staying in the feed are free and always will be. A Spotlight buys
            attention on one tab and nothing else.
          </li>
          <li>
            <strong className="text-ink">We may remove one without warning.</strong> If an
            artist&apos;s music is taken down, if they ask us to, or if a Spotlight was bought
            through a fraudulent or disputed payment, we will pull it from the tab. Where we
            remove a Spotlight for a reason that is our fault rather than yours, we will put the
            credit back.
          </li>
        </ul>
        <p>
          Payments are handled by Stripe. We never see or store your card details. Your card
          statement will show Music On The Rox.
        </p>
      </>
    ),
  },
  {
    title: "Ending things",
    body: (
      <p>
        You can stop using MOTR whenever you like and ask us to delete your account. See the{" "}
        <Link href="/privacy" className="text-gold underline underline-offset-4">
          Privacy Policy
        </Link>.
        We may suspend an account for the abuses described above, or where the law requires it.
      </p>
    ),
  },
  {
    title: "The legal bit",
    body: (
      <p>
        MOTR is provided as-is. We don&apos;t promise it will be uninterrupted or error-free, and
        we&apos;re not liable for indirect losses, including career outcomes that did or
        didn&apos;t follow from using it. Nothing here limits liability we can&apos;t limit by law,
        including for fraud. These terms are governed by the laws of the State of Tennessee and
        the United States. If we change them materially, we&apos;ll tell you before the change
        takes effect.
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
            className="mx-auto h-16 w-auto"
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
