import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { checkAudioIdentity } from "./lib/audioIdentity";
process.loadEnvFile(".env");
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_NEON }) });
const tracks = await p.track.findMany({
  where: { audioVerdict: null, status: { in: ["DISCOVERY","VETTING","GRADUATED"] } },
  select: { id:true, title:true, artistName:true, previewUrl:true },
});
console.log(`OUT scanning ${tracks.length} catalogue tracks (throttled for Apple)`);
let m=0,x=0,u=0,i=0;
for (const t of tracks) {
  i++;
  const { verdict, actual } = await checkAudioIdentity(t);
  await p.track.update({ where:{id:t.id}, data:{ audioVerdict:verdict, audioCheckedAt:new Date() } });
  if (verdict==="MATCH") m++;
  else if (verdict==="MISMATCH") { x++; console.log(`OUT  !! "${t.title}" — ${t.artistName}  IS  "${actual?.title}" — ${actual?.artistName}`); }
  else { u++; }
  if (i % 25 === 0) console.log(`OUT  ...${i}/${tracks.length}  match=${m} mismatch=${x} unverified=${u}`);
  await new Promise(r => setTimeout(r, 2200)); // stay under Apple's rate limit
}
console.log(`OUT FINAL: ${tracks.length} scanned — match=${m} mismatch=${x} unverified=${u}`);
await p.$disconnect();
