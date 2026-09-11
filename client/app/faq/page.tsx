import PageNav from "@/components/PageNav";
import Image from "next/image";
import Link from "next/link";
import { Disc } from "@/components/icons";

export const metadata = {
  title: "How it works — MOTR",
  description: "How MOTR works: blind 30-second clips, and the music you keep."
};

const STEPS = [
  {
    n: "01",
    title: "Fans swipe",
    body: "Every track starts in the open feed. Thirty-second clips, no artist bios, no follower counts. Just whether it sounds good. Swipe right to save it, left to move on.",
  },
  {
    n: "02",
    title: "The crowd decides",
    body: "Tracks that collect enough right-swipes break through. A listener who hears the full 30 seconds before deciding counts double, whichever way they swipe. Nobody can buy their way past this step; it's the one gate money doesn't open.",
  },
  {
    n: "03",
    title: "The best rise",
    body: "Tracks the crowd backs climb the feed and reach more listeners. Nothing here is boosted by a budget. Position is earned by people choosing to keep the song.",
  },
  {
    n: "04",
    title: "You keep what you like",
    body: "Every track you swipe right on is saved to your list, with a link out to the artist so you can follow them wherever you already listen.",
  },
];

const FAQS = [
  {
    q: "Does it cost anything?",
    a: "No. It's free for listeners and free for artists. Submitting your music costs nothing, staying in the feed costs nothing, and there is no paid tier that moves you up it.",
  },
  {
    q: "Why does hearing the whole clip count double?",
    a: "A decision made three seconds in is a reaction to the first thing you hear. One made after the full thirty seconds is a verdict on the song. Both count, but the second one counts twice, whether you swiped left or right. Sitting with a track you end up passing on is just as useful to the artist as one you save, so patience is rewarded rather than agreement.",
  },
  {
    q: "Is any of this paid for?",
    a: "No. There is nothing to buy. Every track is heard with no name attached, and the only thing that moves it is whether people keep it.",
  },
  {
    q: "What if my track doesn't break through?",
    a: "That's a real outcome, and it costs you nothing. Entry is free, the crowd decides, and a track that doesn't connect simply stays in the feed for the next listener.",
  },
  {
    q: "Where does my saved music go?",
    a: "Everything you swipe right on lands in Saved, with a link out to the artist. Pushing those straight into your own streaming library is on the way.",
  },
];

export default function FaqPage() {
  return (
    <main className="bg-bg min-h-screen pb-24">
      <PageNav />
      <header className="border-edge border-b px-6 py-8 text-center">
        <Link href="/" aria-label="MOTR home" className="inline-block">
          <Image src="/motr-logo.png" alt="MOTR" width={1000} height={550} className="mx-auto h-16 w-auto" />
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
          <Disc className="text-gold h-5 w-5" />
          What to expect
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Card
            title="If you're a fan"
            body="An endless feed of music nobody paid to put in front of you. Save what you like. Your right-swipes decide which artists move forward."
          />
          <Card
            title="If you're an artist"
            body="Free entry, and a fair hearing. Your song goes out with no name on it, so what comes back is a verdict on the music rather than on your follower count."
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
