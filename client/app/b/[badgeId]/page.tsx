import type { Metadata } from "next";
import Link from "next/link";
import { BADGES } from "@/lib/achievements";
import { APP_URL } from "@/lib/appUrl";

/**
 * The page a copied badge link opens.
 *
 * The listener's whole job is Copy Link. Everything that makes it look like
 * something when it lands in a post is done by the metadata here: the
 * graphic, the headline, and a line telling a stranger what MOTR is.
 *
 * There is nothing personal in the address. It names a badge, not a person,
 * which is the point: an earlier version put the listener's id in the link,
 * and that id is enough to read their saved list. Nobody should have to
 * publish one to show off a badge.
 */

type Params = { params: Promise<{ badgeId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { badgeId } = await params;
  const badge = BADGES.find((b) => b.id === badgeId);

  if (!badge) {
    return { title: "MOTR", description: "Find new artists, thirty seconds at a time." };
  }

  const title = `Badge unlocked on MOTR: ${badge.name}`;
  const description = `${badge.note}. MOTR plays you thirty seconds of a track with the artist hidden. Keep it and you find out who made it.`;
  const image = `${APP_URL}/api/achievement-card/${badge.id}?shape=og&v=4`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${APP_URL}/b/${badge.id}`,
      siteName: "Music On The Rox",
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: badge.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Thirty-one badges, all known at build time, so every page is prerendered. */
export function generateStaticParams() {
  return BADGES.map((b) => ({ badgeId: b.id }));
}

export default async function BadgePage({ params }: Params) {
  const { badgeId } = await params;
  const badge = BADGES.find((b) => b.id === badgeId);

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
        </>
      ) : (
        <h1 className="font-display mt-10 text-4xl uppercase tracking-wide">Find new artists</h1>
      )}

      {/* What someone arriving from a post actually needs: what this is, and
          one way in. */}
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
