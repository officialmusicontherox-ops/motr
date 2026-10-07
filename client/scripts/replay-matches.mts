/** Replays the tracks that were refused and then added by hand, to see why matching failed. */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseSpotifyTrackId } from "../lib/spotifyUrl";
import { fetchSpotifyOembed, fetchSpotifyArtist, searchItunesAll, artistMatches, titleMatches } from "../lib/trackLookup";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const rows = await prisma.refusedSubmission.findMany({
  where: { status: "ADDED" },
  select: { spotifyUrl: true, reason: true },
});
console.log(`tracks refused then added by hand: ${rows.length}\n`);

for (const row of rows) {
  const id = parseSpotifyTrackId(row.spotifyUrl);
  if (!id) { console.log(`skip (unparseable): ${row.spotifyUrl}\n`); continue; }

  const [oembed, artist] = await Promise.all([fetchSpotifyOembed(id), fetchSpotifyArtist(id)]);
  const title = (oembed.title ?? "").trim();
  console.log("=".repeat(72));
  console.log(`SPOTIFY SAYS:  "${title}"  by  "${artist}"`);

  const lead = (artist ?? "").split(/[,&]/)[0].trim();
  for (const term of [`${lead} ${title}`, `${title} ${lead}`]) {
    const cands = await searchItunesAll(term, 20);
    console.log(`\n  search "${term}" -> ${cands.length} results`);
    for (const c of cands.slice(0, 5)) {
      const aOk = artistMatches(artist ?? "", c.artistName);
      const tOk = titleMatches(title, c.trackName);
      console.log(`    ${aOk ? "A" : "-"}${tOk ? "T" : "-"}  "${c.trackName}"  by  "${c.artistName}"`);
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log();
}
