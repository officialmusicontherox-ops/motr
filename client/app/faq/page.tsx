import PageNav from "@/components/PageNav";
import Image from "next/image";
import Link from "next/link";
import { Crown } from "@/components/icons";

export const metadata = {
  title: "How it works — MOTR",
  description: "How tracks get from a fan swipe to a real curator's playlist.",
};

const STEPS = [
  {
    n: "01",
    title: "Fans swipe",
    body: "Every track starts in the open feed. Thirty-second clips, no artist bios, no follower counts — just whether it sounds good. Swipe right to save it, left to move on.",
  },
  {
    n: "02",
    title: "The crowd decides",
    body: "Tracks that collect enough right-swipes break through. Nobody can buy their way past this step — it's the one gate money doesn't open.",
  },
  {
    n: "03",
    title: "The artist gets the option",
    body: "Once a track breaks through, its artist is invited to submit it to curators for a flat fee. That fee buys consideration by real people, not a guaranteed placement.",
  },
  {
    n: "04",
    title: "Five curators, matched by genre",
    body: "Approved submissions go to five curators who actually work in that genre — not a mass blast. Each one decides independently.",
  },
  {
    n: "05",
    title: "Real placements only",
    body: "A curator earns by putting the track on a playlist, posting it in a TikTok, Reel or Short, or writing about it. Playlist adds and videos have to stay up at least four days — placements that vanish overnight don't count.",
  },
];

const FAQS = [
  {
    q: "Do I have to pay to be heard?",
    a: "No. Getting into the fan feed is free, and staying there is free. A fee only ever comes up after fans have already pushed your track through — and it's optional at that point.",
  },
  {
    q: "Is this payola?",
    a: "The thing money can't buy here is the part that matters: the fan vote. Artists can't pay to break through, can't pay to be featured, and can't pay for a positive review. What the fee covers is a curator's time and attention on a track the crowd already validated.",
  },
  {
    q: "What if no curator features my track?",
    a: "That's a real outcome, and it's why we say the fee buys consideration rather than placement. Five genre-matched curators hearing your song is the product; what they do with it is their call.",
  },
  {
    q: "How do curators get paid?",
    a: "A flat fee per verified share — a playlist add or a short-form video held four days, or a published piece. Curators aren't paid for passing, and they aren't paid more for saying nice things.",
  },
  {
    q: "When can a curator cash out?",
    a: "Earnings clear after a short holding period, then can be withdrawn once the balance reaches the minimum. The hold exists so payouts aren't sent on money that could still be refunded.",
  },
  {
    q: "Where does my saved music go?",
    a: "Everything you swipe right on lands in Saved. Connecting a streaming account so those tracks flow into a real playlist is on the way.",
  },
];

export default function FaqPage() {
  return (
    <main className="bg-bg min-h-screen pb-24">
      <PageNav />
      <header className="border-edge border-b px-6 py-8 text-center">
        <Link href="/" aria-label="MOTR home" className="inline-block">
          <Image src="/motr-logo.png" alt="MOTR" width={325} height={145} className="mx-auto h-12 w-auto" />
        </Link>
        <h1 className="font-display mt-6 text-4xl uppercase tracking-wide">How it works</h1>
        <p className="text-muted mx-auto mt-2 max-w-md text-sm">
          Good songs lose to good marketing every day. This is an attempt to flip that.
        </p>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-10">
        <ol className="space-y-5">
          {STEPS.map((s) => (
            <li key={s.n} className="border-edge bg-surface flex gap-4 rounded-2xl border p-5">
              <span className="font-display text-gold/60 shrink-0 text-2xl leading-none">{s.n}</span>
              <div>
                <h2 className="font-semibold">{s.title}</h2>
                <p className="text-muted mt-1 text-sm leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="expect" className="mx-auto max-w-2xl scroll-mt-6 px-6">
        <h2 className="font-display flex items-center gap-2 text-2xl uppercase tracking-wide">
          <Crown className="text-gold h-5 w-5" />
          What to expect
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Card
            title="If you're a fan"
            body="An endless feed of music nobody paid to put in front of you. Save what you like — your right-swipes are what decide which artists move forward."
          />
          <Card
            title="If you're an artist"
            body="Free entry, and no pressure until the crowd has spoken. If you break through, a flat fee puts you in front of five curators in your genre. No promises beyond that."
          />
          <Card
            title="If you're a curator"
            body="A small, genre-matched queue of pre-validated tracks — not a slush pile. Share what's genuinely good on a playlist, in a video, or in writing, and get a flat fee per verified share."
          />
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-12">
        <h2 className="font-display text-2xl uppercase tracking-wide">Questions</h2>
        <div className="mt-5 space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="border-edge bg-surface group rounded-2xl border p-5 open:pb-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span className="text-gold shrink-0 text-xl transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-muted mt-3 text-sm leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="bg-gold text-bg rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide"
          >
            Start swiping
          </Link>
          <Link
            href="/contact"
            className="border-edge hover:border-gold rounded-full border px-6 py-3 text-sm font-semibold transition"
          >
            Contact us
          </Link>
          <Link
            href="/privacy"
            className="border-edge hover:border-gold rounded-full border px-6 py-3 text-sm font-semibold transition"
          >
            Privacy
          </Link>
        </div>
      </section>
    </main>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-edge bg-surface rounded-2xl border p-5">
      <h3 className="text-gold font-semibold">{title}</h3>
      <p className="text-muted mt-2 text-sm leading-relaxed">{body}</p>
    </div>
  );
}
