import type { Metadata } from "next";
import BattlesClient from "./BattlesClient";
import { battleForCard } from "@/lib/battles";

const DESCRIPTION = "Two songs, no names. Hear both and pick the one you would play again.";

/**
 * A shared battle link carries its own preview.
 *
 * When somebody pastes the link into a message or a post, the card that
 * unfurls is that battle, with both songs on it, instead of a generic page
 * title. The link is only ever handed out after a vote or to the artists
 * in it, so naming the songs here gives nothing away to a blind listener.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}): Promise<Metadata> {
  const plain: Metadata = { title: "Battles | MOTR", description: DESCRIPTION };
  const { b } = await searchParams;
  if (!b) return plain;

  const battle = await battleForCard(b).catch(() => null);
  if (!battle) return plain;

  const title = `${battle.a.artistName} vs ${battle.b.artistName} | MOTR Battles`;
  const description = battle.closed
    ? "The votes are in. See how this battle finished."
    : "Two songs, head to head. Hear both and pick your winner before Saturday.";
  const image = `https://app.musicontherox.com/api/battles/card?b=${encodeURIComponent(b)}&format=post`;

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1080, height: 1080 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function BattlesPage() {
  return <BattlesClient />;
}
