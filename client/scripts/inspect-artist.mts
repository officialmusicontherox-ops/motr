for (const artist of ["Wavy Josef", "Victoria Crosby", "Brit Scoops"]) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&media=music&entity=song&attribute=artistTerm&limit=200`;
  const res = await fetch(url);
  const data = res.ok ? await res.json() : { results: [] };
  const all = (data.results ?? []) as { trackName: string; artistName: string; releaseDate?: string }[];
  const names = [...new Set(all.map((r) => r.artistName))];
  console.log(`\n${artist}  —  ${all.length} songs across artists: ${names.slice(0, 5).join(" | ")}`);
  for (const r of all.slice(0, 10)) {
    console.log(`   "${r.trackName}" — ${r.artistName}  (${(r.releaseDate ?? "").slice(0, 10)})`);
  }
  await new Promise((r) => setTimeout(r, 3500));
}
