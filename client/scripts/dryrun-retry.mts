/** What "Retry all" would do, without writing anything. */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseSpotifyTrackId } from "../lib/spotifyUrl";
import { resolveSpotifyTrack, TrackLookupError } from "../lib/trackLookup";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const pending = await prisma.refusedSubmission.findMany({
  where: { status: "PENDING" },
  orderBy: { createdAt: "asc" },
});
console.log(`${pending.length} pending refusals\n`);

let would = 0;
for (const row of pending) {
  const id = parseSpotifyTrackId(row.spotifyUrl);
  if (!id) { console.log(`SKIP   unparseable: ${row.spotifyUrl}`); continue; }
  try {
    const r = await resolveSpotifyTrack(id);
    // Would it collide with something already in the feed?
    const existing = await prisma.track.findUnique({
      where: { source_externalId: { source: "SPOTIFY", externalId: id } },
      select: { id: true },
    });
    would++;
    console.log(`WOULD ADD  "${r.title}" by ${r.artistName}${existing ? "  (already in the feed, would just close the refusal)" : ""}`);
  } catch (e) {
    console.log(`still fails  ${row.spotifyUrl.slice(0, 60)}`);
    console.log(`             ${(e instanceof TrackLookupError ? e.message : String(e)).slice(0, 110)}`);
  }
  await new Promise((r) => setTimeout(r, 9000)); // stay well under Apple's limit
}
console.log(`\n${would} of ${pending.length} would be rescued.`);
await prisma.$disconnect();
