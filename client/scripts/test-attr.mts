/** Does searching the artist field alone surface the tracks that combined search missed? */
const cases: [string, string][] = [
  ["Wavy Josef", "WAiSTELiNE"],
  ["Songs of Solomon", "Kid"],
  ["Victoria Crosby", "If She Can Take Him"],
  ["Brit Scoops", "Happy Hour"],
];

for (const [artist, title] of cases) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&media=music&entity=song&attribute=artistTerm&limit=200`;
  const res = await fetch(url);
  const data = res.ok ? await res.json() : { results: [] };
  const all = (data.results ?? []) as { trackName: string; artistName: string; previewUrl?: string }[];
  const hit = all.find((r) => r.trackName?.toLowerCase().includes(title.toLowerCase().slice(0, 12)));
  console.log(`${artist.padEnd(20)} artistTerm results: ${String(all.length).padStart(3)}   "${title}" found: ${hit ? "YES -> " + hit.trackName : "no"}`);
  await new Promise((r) => setTimeout(r, 3500));
}
