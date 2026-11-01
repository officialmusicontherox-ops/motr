import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { artistUnsubscribeToken, unsubscribeToken } from "@/lib/nudges";
import { optOutFan } from "@/lib/optOut";

export const metadata = { title: "Unsubscribe — MOTR" };

/**
 * One page, no sign-in, and the link is HMAC-signed so it can only ever opt
 * out the person it was sent to.
 *
 * A listener's link acts on the click. An unsubscribe that asks for anything
 * first is one that does not work, and the complaint that follows costs more
 * than the address was worth.
 *
 * An artist's asks once, because the same click also takes their music off
 * the platform. A stray tap in a mail app, or a scanner following links in
 * the message, should not empty somebody's catalogue. One button is still a
 * one-page unsubscribe with no account needed.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{
    fan?: string;
    artist?: string;
    t?: string;
    state?: string;
    pulled?: string;
  }>;
}) {
  const { fan: fanId, artist: artistId, t, state: done, pulled: pulledParam } = await searchParams;

  let state: "listener" | "artist" | "confirm" | "invalid" = "invalid";
  let pulled = Number(pulledParam ?? 0);
  let trackCount = 0;

  if (done === "artist") {
    // Came back from the confirm button.
    state = "artist";
  } else if (done === "invalid") {
    state = "invalid";
  } else if (fanId && t && t === unsubscribeToken(fanId)) {
    state = await optOutFan(fanId, "link")
      .then(() => "listener" as const)
      .catch(() => "invalid" as const);
  } else if (artistId && t && t === artistUnsubscribeToken(artistId)) {
    // Nothing is changed yet. This only says what the button will do.
    const artist = await prisma.artist
      .findUnique({
        where: { id: artistId },
        select: {
          name: true,
          _count: { select: { tracks: { where: { status: { not: "REJECTED" } } } } },
        },
      })
      .catch(() => null);

    if (artist) {
      state = "confirm";
      trackCount = artist._count.tracks;
    }
  }

  return (
    <main className="bg-bg flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl uppercase tracking-wide">
        {state === "invalid"
          ? "Link not recognized"
          : state === "confirm"
            ? "Before you go"
            : "Unsubscribed"}
      </h1>

      {state === "confirm" && (
        <>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            Email is the only way we can reach an artist. The charts, the weekly contest and
            anything about your release all go out that way, so unsubscribing also takes{" "}
            {trackCount === 1 ? "your track" : `your ${trackCount} tracks`} off the platform.
          </p>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            Nothing is deleted. Submit again any time, or reply to any MOTR email, and we will put
            you back on with your music.
          </p>

          <form action="/api/unsubscribe" method="post" className="mt-2 flex flex-col gap-3">
            <input type="hidden" name="artist" value={artistId ?? ""} />
            <input type="hidden" name="t" value={t ?? ""} />
            <button
              type="submit"
              className="border-nope text-nope hover:bg-nope/10 rounded-full border px-6 py-3 text-sm font-bold uppercase tracking-wide transition"
            >
              Yes, unsubscribe me and take my music off the platform
            </button>
          </form>

          <Link
            href="/"
            className="bg-gold text-bg mt-1 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide"
          >
            Keep me on MOTR
          </Link>
        </>
      )}

      {state !== "confirm" && (
        <>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            {state === "listener" &&
              "That's done. We won't send you any more update emails. Nothing else changes: your saved tracks are still yours and you can keep swiping whenever you like."}
            {state === "artist" &&
              `That's done. We won't email you again, and ${
                pulled === 1 ? "your track has" : `your ${pulled} tracks have`
              } been taken off the platform. Nothing is deleted. Submit again any time, or reply to any MOTR email, and we will put you back on with your music.`}
            {state === "invalid" &&
              "That unsubscribe link isn't valid. It may have already been used, or been cut short by your email app. Reply to any MOTR email and we'll take you off by hand."}
          </p>
          <Link
            href="/"
            className="bg-gold text-bg mt-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide"
          >
            Back to MOTR
          </Link>
        </>
      )}
    </main>
  );
}
