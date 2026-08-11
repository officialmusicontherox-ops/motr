// _full.ts
import { PrismaClient as PrismaClient2 } from "@prisma/client";
import { PrismaPg as PrismaPg2 } from "@prisma/adapter-pg";

// lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
var globalForPrisma = globalThis;
var adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
var prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// lib/trackLookup.ts
var CONTACT_EMAIL = process.env.EMAIL_REPLY_TO ?? "officialmusicontherox@gmail.com";
function normaliseName(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(feat|ft|featuring|with|and)\b/g, "&").replace(/[^a-z0-9&]+/g, " ").trim();
}
function artistMatches(expected, candidate) {
  const full = normaliseName(expected);
  const cand = normaliseName(candidate);
  if (!full || !cand) return false;
  if (full === cand) return true;
  const segments = candidate.split(/[,&]/).map((s) => normaliseName(s)).filter(Boolean);
  if (segments.includes(full)) return true;
  const lead = normaliseName(expected.split(/[,&]/)[0]);
  const candidateLead = segments[0];
  if (!lead || !candidateLead) return false;
  return lead === candidateLead;
}
function titleMatches(expected, candidate) {
  const strip = (v) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[([\-–]\s*(feat\.?|ft\.?|featuring|with)\s[^)\]]*[)\]]?/g, " ").replace(
    /\b(remaster(ed)?(\s*\d{4})?|explicit|clean|mono|stereo|bonus track|single version|album version|radio edit)\b/g,
    " "
  ).replace(/[^a-z0-9]+/g, " ").trim();
  const a = strip(expected);
  const b = strip(candidate);
  return Boolean(a) && a === b;
}
async function searchItunesAll(term, limit = 15) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term
  )}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).filter((r) => r.previewUrl);
}

// lib/audioIdentity.ts
async function checkAudioIdentity(track) {
  const terms = [`${track.artistName} ${track.title}`, `${track.title} ${track.artistName}`];
  for (const term of terms) {
    const results = await searchItunesAll(term, 25).catch(() => []);
    const found = results.find((r) => r.previewUrl === track.previewUrl);
    if (!found) continue;
    const ok = artistMatches(track.artistName, found.artistName) && titleMatches(track.title, found.trackName);
    return {
      verdict: ok ? "MATCH" : "MISMATCH",
      actual: { title: found.trackName, artistName: found.artistName }
    };
  }
  return { verdict: "UNVERIFIED", actual: null };
}

// _full.ts
process.loadEnvFile(".env");
var p = new PrismaClient2({ adapter: new PrismaPg2({ connectionString: process.env.DATABASE_URL_NEON }) });
var tracks = await p.track.findMany({
  where: { audioVerdict: null, status: { in: ["DISCOVERY", "VETTING", "GRADUATED"] } },
  select: { id: true, title: true, artistName: true, previewUrl: true }
});
console.log(`OUT scanning ${tracks.length} catalogue tracks (throttled for Apple)`);
var m = 0;
var x = 0;
var u = 0;
var i = 0;
for (const t of tracks) {
  i++;
  const { verdict, actual } = await checkAudioIdentity(t);
  await p.track.update({ where: { id: t.id }, data: { audioVerdict: verdict, audioCheckedAt: /* @__PURE__ */ new Date() } });
  if (verdict === "MATCH") m++;
  else if (verdict === "MISMATCH") {
    x++;
    console.log(`OUT  !! "${t.title}" \u2014 ${t.artistName}  IS  "${actual?.title}" \u2014 ${actual?.artistName}`);
  } else {
    u++;
  }
  if (i % 25 === 0) console.log(`OUT  ...${i}/${tracks.length}  match=${m} mismatch=${x} unverified=${u}`);
  await new Promise((r) => setTimeout(r, 2200));
}
console.log(`OUT FINAL: ${tracks.length} scanned \u2014 match=${m} mismatch=${x} unverified=${u}`);
await p.$disconnect();
