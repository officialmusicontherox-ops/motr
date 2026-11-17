import PageNav from "@/components/PageNav";
import { BUNDLES, CAP_PLACES, SLOTS, SPOTLIGHT_SPAN, price } from "@/lib/spotlightBundles";
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
    body: "Tracks that collect enough saves break through. A listener who hears the full 30 seconds before deciding counts double, whichever way they swipe. Nobody can buy their way past this step; it's the one gate money doesn't open.",
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
    a: "No. Listening is free and submitting is free. Artists are never charged for anything, and there is no paid tier that moves you up the feed. The one thing on sale is a Spotlight, which a listener can buy to promote an artist they like, and that has nothing to do with the charts.",
  },
  {
    q: "Why does hearing the whole clip count double?",
    a: "A decision made three seconds in is a reaction to the first thing you hear. One made after the full thirty seconds is a verdict on the song. Both count, but the second one counts twice, whether you swiped left or right. Sitting with a track you end up passing on is just as useful to the artist as one you save, so patience is rewarded rather than agreement.",
  },
  {
    q: "Can anyone pay to get on the charts?",
    a: "No, and this is the one thing we will not bend on. Every track is heard with no artist name attached, and the only thing that moves it up is whether people keep it. A Spotlight is advertising on its own tab and counts for nothing on the chart, the weekly winner, or any figure an artist is measured by.",
  },
  {
    q: "How are Top Artists and the weekly winner decided?",
    a: "By saves, from listeners who don't know whose song they are hearing. Each artist's two best songs of the week are added together, the same two-song limit the song chart uses. You can send as many songs as you like and every one stays in the feed, but only your best two count toward the chart. The weekly winner is the artist at number one on Top Artists when the week closes, Saturday at midnight Central.",
  },
  {
    q: "What if my track doesn't break through?",
    a: "That's a real outcome, and it costs you nothing. Entry is free, the crowd decides, and a track that doesn't connect simply stays in the feed for the next listener.",
  },
  {
    q: "What are Battles?",
    a: "A second way to judge music. You get two songs from the same genre with no names on them, play each one as often as you like, and choose the one you would play again. Once you vote, both artists are revealed along with how the vote is going, and the song you picked goes into your Saved list. Everybody gets the same battles. New ones open every Sunday and they all close Saturday at midnight Central, when the song with the bigger share of the vote takes the win. If you can't stand either song, skip it and nobody is counted.",
  },
  {
    q: "How are battles put together?",
    a: "At random, inside a genre. Each artist is in one battle a week, so nobody faces their own song and a bigger catalogue can't win more. Songs with AI vocals are paired with each other. If a genre has an odd number of artists, one sits out that week and goes in first the next. If a song is taken off MOTR during its battle, that battle is called off and the other artist is paired again where possible. You can share any battle you have voted in, as a link or as an image for a story or a post.",
  },
  {
    q: "Do Battles affect the charts or the weekly winner?",
    a: "No. Winning a battle is a Battle Win for that artist, and Battle Wins have a board of their own on the Charts tab, by week and by month. They have no effect on the song chart, the artist chart, the weekly winner or the write-up that goes with it. Those come from saves alone. An artist's Battle Wins are kept for good and never reset.",
  },
  {
    q: "What is a Spotlight?",
    a: `A way to back an artist you love. Swipe up on a track, or tap an artist's name in Saved, and they go on the Spotlight tab for ${SPOTLIGHT_SPAN} — named, with their photo and links to hear more. There are ${SLOTS} places, and if they are all full yours waits and starts the moment one frees, so you never lose time you paid for. One artist can hold ${CAP_PLACES} at a time, so every place on the tab is a different artist. Another Spotlight for the same artist waits and starts when theirs ends. Swiping up also saves the track, the same as swiping right.`,
  },
  {
    q: "What does a Spotlight cost, and can I get a refund?",
    a: `${BUNDLES.map((b) => `${price(b.cents)} for ${b.credits}`).join(", ")}. You buy a few and spend them whenever something lands, because stopping to pay mid-swipe would ruin the moment it is for. Spotlights are non-refundable: they arrive instantly as credit and are used up the moment you spend one, so there are no refunds, exchanges or transfers, and unspent ones have no cash value.`,
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
            body="An endless feed of music nobody paid to put in front of you. Save what you like. Your saves decide which artists move forward."
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
