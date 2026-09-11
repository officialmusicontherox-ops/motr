import PageNav from "@/components/PageNav";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service — MOTR",
  description: "The rules for the listeners and artists using MOTR."
};

const EMAIL = "officialmusicontherox@gmail.com";
const UPDATED = "August 3, 2026";

/**
 * Written against what the product actually does.
 *
 * MOTR is free on both sides: nothing is charged to a listener and nothing is
 * charged to an artist. The curator programme, the submission fee and the
 * payouts that went with them were retired, and the sections covering them
 * were removed rather than left standing as terms for something that no
 * longer exists.
 */
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "The short version",
    body: (
      <ul>
        <li>MOTR is free. Nothing is charged to anyone, ever.</li>
        <li>Artists submit music for free, and it stays in the feed for free.</li>
        <li>
          Every track is heard with{" "}
          <strong className="text-white">no artist name attached</strong>, so what comes back is a
          verdict on the song.
        </li>
        <li>Nobody can buy their way past the fan vote, because there is nothing to buy.</li>
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
          Submitting is free, and there is nothing to buy at any point afterwards.
        </p>
        <ul>
          <li>
            <span className="text-white">What you get:</span> your track goes into the feed and is
            played to listeners with no name and no artwork they recognise, so the response is to
            the music itself.
          </li>
          <li>
            <span className="text-white">What we don&apos;t promise:</span> a particular number of
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
          <span className="text-white">If you sign in, we may email you.</span> That means things
          like a reminder when you haven&apos;t swiped in a while, or news about tracks you
          saved, not adverts for anyone else. Every one carries an unsubscribe link and a single
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
        Clips are 30-second previews supplied by third-party catalog services. Artists and rights
        holders keep everything they own; we claim no rights in your music beyond showing the
        preview inside MOTR. If you hold rights to something here and want it removed, email us and
        we&apos;ll take it down.
      </p>
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
