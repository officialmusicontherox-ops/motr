import { prisma } from "./prisma";
import { sendEmail, artistSharePageEmail, type Attachment } from "./email";
import { renderShareCard } from "./shareCard";

/**
 * Telling artists their page exists, with the card attached.
 *
 * Attached rather than only linked: mail clients block remote images until
 * the reader allows them, and an artist on a phone needs a file they can save
 * and put straight on a story. A card they cannot see is a card they cannot
 * post.
 *
 * Shared by the dashboard button and the send script so there is one
 * behaviour, not two that drift.
 */

/** At most this many cards per email, so a prolific artist's mail still arrives. */
const MAX_CARDS = 3;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "track";

export type SharePageRecipient = {
  artistId: string;
  name: string;
  email: string;
  tracks: { id: string; title: string }[];
};

/** Artists who have music in the feed and have not been told about their page. */
export async function pendingSharePageArtists(): Promise<SharePageRecipient[]> {
  const due = await prisma.artist.findMany({
    where: {
      emailOptOut: false,
      sharePageEmailAt: null,
      tracks: { some: { status: { not: "REJECTED" } } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      tracks: {
        where: { status: { not: "REJECTED" } },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true },
      },
    },
  });

  return due.map((a) => ({ artistId: a.id, name: a.name, email: a.email, tracks: a.tracks }));
}

/** Their story cards as files, ready to attach. */
async function cardsFor(r: SharePageRecipient): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const t of r.tracks.slice(0, MAX_CARDS)) {
    try {
      const res = await renderShareCard({
        trackId: t.id,
        title: t.title,
        artistName: r.name,
        square: false,
      });
      out.push({
        filename: `motr-${slug(t.title)}-story.png`,
        content: Buffer.from(await res.arrayBuffer()),
      });
    } catch {
      // A card that won't draw must not cost the artist the email.
    }
  }
  return out;
}

export type SharePageSendResult = {
  eligible: number;
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
};

export async function sendSharePageEmails(
  opts: { limit?: number } = {}
): Promise<SharePageSendResult> {
  const due = await pendingSharePageArtists();
  const batch = opts.limit ? due.slice(0, opts.limit) : due;

  let sent = 0;
  let failed = 0;
  const failures: { email: string; error: string }[] = [];

  for (const r of batch) {
    const attachments = await cardsFor(r);
    const result = await sendEmail(
      r.email,
      artistSharePageEmail({ name: r.name, tracks: r.tracks, attachments })
    );

    if (!result.ok) {
      failed += 1;
      failures.push({ email: r.email, error: result.error ?? "unknown" });
      continue;
    }

    sent += 1;
    // Marked one at a time as it goes, so a failure part-way through never
    // re-sends to someone who already had it.
    await prisma.artist
      .update({ where: { id: r.artistId }, data: { sharePageEmailAt: new Date() } })
      .catch(() => {});
  }

  return { eligible: due.length, sent, failed, failures };
}
