import type { Metadata } from "next";
import Link from "next/link";
import { badgeRarity, evaluate, fanStats } from "@/lib/achievements";
import { APP_URL } from "@/lib/appUrl";

/**
 * The page a copied badge link opens.
 *
 * The listener's whole job is Copy Link. Everything that makes it look like
 * something when it lands in a post is done here, by the metadata: the
 * graphic, the headline and the line telling a stranger what MOTR is. No
 * uploading, no attaching, no saving an image first.
 *
 * Public on purpose, and carries nothing about who earned it. The id in the
 * path only decides whether the badge was really earned, so a link cannot
 * claim one nobody holds.
 */

type Params = { params: Promise<{ fanId: string; badgeId: string }> };

async function load(fanId: string, badgeId: string) {
  const [stats, rarity] = await Promise.all([fanStats(fanId), badgeRarity()]);
  const badge = evaluate(stats).find((b) => b.id === badgeId && b.earned) ?? null;
  return { badge, heldBy: badge ? (rarity[badge.id] ?? null) : null };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { fanId, badgeId } = await params;
  const { badge, heldBy } = await load(fanId, badgeId);

  if (!badge) {
    return { title: "MOTR", description: "Find new artists, thirty seconds at a time." };
  }

  const rare =
    typeof heldBy === "number" && heldBy > 0
      ? heldBy < 0.01
        ? " Only the top 1% of listeners have it."
        : ` Only ${Math.round(heldBy * 100)}% of listeners have it.`
      : "";

  const title = `Badge unlocked on MOTR: ${badge.name}`;
  const description = `${badge.note}.${rare} MOTR plays you thirty seconds of a track with the artist hidden. Keep it and you find out who made it.`;
  const image = `${APP_URL}/api/achievement-card/${fanId}?badge=${badge.id}&shape=og&v=2`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${APP_URL}/b/${fanId}/${badge.id}`,
      siteName: "Music On The Rox",
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: badge.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function BadgePage({ params }: Params) {
  const { fanId, badgeId } = await params;
  const { badge, heldBy } = await load(fanId, badgeId);

  const rare =
    typeof heldBy === "number" && heldBy > 0
      ? heldBy < 0.01
        ? "Earned by the top 1% of listeners"
        : `Earned by ${Math.round(heldBy * 100)}% of listeners`
      : null;

  return (
    <main className="bg-bg text-ink flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <p className="motr-label text-gold">Music On The Rox</p>

      {badge ? (
        <>
          <p className="text-muted mt-10 text-xs uppercase tracking-[0.3em]">Badge unlocked</p>
          <h1 className="font-display mt-3 text-5xl uppercase leading-none tracking-wide md:text-6xl">
            {badge.name}
          </h1>
          <span className="bg-gold mt-6 block h-1.5 w-28 rounded-full" />
          <p className="mt-6 max-w-md text-lg">{badge.note}</p>
          {rare && <p className="text-gold mt-4 text-xs uppercase tracking-[0.2em]">{rare}</p>}
        </>
      ) : (
        <h1 className="font-display mt-10 text-4xl uppercase tracking-wide">Find new artists</h1>
      )}

      {/* What a stranger arriving from a post actually needs: what this is,
          and one way in. */}
      <p className="text-muted mt-12 max-w-sm text-sm leading-relaxed">
        MOTR plays you thirty seconds of a track with the artist hidden. Keep it and you find out
        who made it. Free, no account, works in your browser.
      </p>
      <Link
        href="/"
        className="border-gold text-gold hover:bg-gold/10 mt-6 rounded-full border px-8 py-3 text-sm font-semibold uppercase tracking-[0.15em] transition"
      >
        Start listening
      </Link>
      <p className="text-muted mt-10 text-xs">app.musicontherox.com</p>
    </main>
  );
}
