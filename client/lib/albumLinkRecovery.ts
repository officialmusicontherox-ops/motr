import { prisma } from "./prisma";
import { sendEmail, albumLinkFixEmail } from "./email";
import { describeSpotifyLink, parseSpotifyTrackId } from "./spotifyUrl";

/**
 * Artists whose submissions were refused for pointing at an album.
 *
 * A refusal only ever told the dashboard. Dismissing one cleared it from view
 * without reaching the person who sent it, so these artists submitted, heard
 * nothing they could act on, and assumed they had been passed over.
 *
 * Grouped by address rather than by refusal: six links from one artist is one
 * email, not six.
 */

export type StuckArtist = {
  email: string;
  name: string | null;
  refusalIds: string[];
  count: number;
};

export async function artistsStuckOnAlbumLinks(): Promise<StuckArtist[]> {
  const rows = await prisma.refusedSubmission.findMany({
    where: { status: { not: "ADDED" }, helpedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const albums = rows.filter(
    (r) => !parseSpotifyTrackId(r.spotifyUrl) && describeSpotifyLink(r.spotifyUrl) === "album"
  );

  const byEmail = new Map<string, string[]>();
  for (const r of albums) {
    const key = r.artistEmail.trim().toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), r.id]);
  }

  const out: StuckArtist[] = [];
  for (const [email, refusalIds] of byEmail) {
    // An address that cannot receive mail is not worth a send. A typo in the
    // domain is exactly how these artists got stuck in the first place, and a
    // shape check is not enough: gmail.vom and gmail.com are both well formed,
    // and one of them had a real artist behind it.
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) continue;
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    const NEAR_MISSES = ["gmail.vom", "gmail.con", "gmail.cm", "gmial.com", "gmai.com", "gmail.co"];
    if (NEAR_MISSES.includes(domain)) continue;

    const artist = await prisma.artist.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { name: true },
    });
    out.push({ email, name: artist?.name ?? null, refusalIds, count: refusalIds.length });
  }
  return out;
}

export async function sendAlbumLinkFixes(appUrl: string) {
  const due = await artistsStuckOnAlbumLinks();
  let sent = 0;
  let failed = 0;

  for (const a of due) {
    const result = await sendEmail(a.email, albumLinkFixEmail({ name: a.name, count: a.count, appUrl }));
    if (!result.ok) {
      failed += 1;
      continue;
    }
    sent += 1;
    // Marked as it goes, so a failure part-way through never re-sends to
    // someone who already had it.
    await prisma.refusedSubmission
      .updateMany({ where: { id: { in: a.refusalIds } }, data: { helpedAt: new Date() } })
      .catch(() => {});
  }

  return { eligible: due.length, sent, failed };
}
