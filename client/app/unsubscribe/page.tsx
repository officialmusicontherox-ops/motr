import Link from "next/link";
import { artistUnsubscribeToken, unsubscribeToken } from "@/lib/nudges";
import { optOutArtist, optOutFan } from "@/lib/optOut";

export const metadata = { title: "Unsubscribe — MOTR" };

/**
 * One click, no sign-in, no confirmation step.
 *
 * An unsubscribe that asks someone to log in first is an unsubscribe that
 * doesn't work, and the complaint that follows costs more than the address
 * was worth. The link is HMAC-signed so it can only ever opt out the person
 * it was sent to.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ fan?: string; artist?: string; t?: string }>;
}) {
  const { fan: fanId, artist: artistId, t } = await searchParams;

  // One page for both audiences. Which row gets opted out is decided by the
  // signature, not by the id alone — an unsigned or mismatched link does
  // nothing at all.
  let state: "listener" | "artist" | "invalid" = "invalid";
  let pulled = 0;

  if (fanId && t && t === unsubscribeToken(fanId)) {
    state = await optOutFan(fanId, "link")
      .then(() => "listener" as const)
      .catch(() => "invalid" as const);
  } else if (artistId && t && t === artistUnsubscribeToken(artistId)) {
    // An artist comes off with their music. Their address is the only way
    // the platform can reach them, so there is no version of this where the
    // tracks stay in rotation.
    state = await optOutArtist(artistId, "link")
      .then((r) => {
        pulled = r.tracksPulled;
        return "artist" as const;
      })
      .catch(() => "invalid" as const);
  }

  return (
    <main className="bg-bg flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl uppercase tracking-wide">
        {state === "invalid" ? "Link not recognized" : "Unsubscribed"}
      </h1>
      <p className="text-muted max-w-sm text-sm leading-relaxed">
        {state === "listener" &&
          "That's done. We won't send you any more update emails. Nothing else changes: your saved tracks are still yours and you can keep swiping whenever you like."}
        {state === "artist" &&
          `That's done. We won't send you any more emails, and because email is the only way we can reach an artist, ${
            pulled === 1 ? "your track has" : `your ${pulled} tracks have`
          } been taken out of rotation as well. Nothing is deleted. Reply to any MOTR email and we can put you back on and your music with it.`}
        {state === "invalid" &&
          "That unsubscribe link isn't valid. It may have already been used, or been cut short by your email app. Reply to any MOTR email and we'll take you off by hand."}
      </p>
      <Link
        href="/"
        className="bg-gold text-bg mt-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide"
      >
        Back to MOTR
      </Link>
    </main>
  );
}
