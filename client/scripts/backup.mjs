/**
 * Exports every row in the database to a single JSON file.
 *
 * Not a pg_dump: Neon runs Postgres 18 and the client here is 17, which
 * refuses to dump a newer server. This needs no client tools at all.
 *
 * Restoring = `prisma migrate deploy` to rebuild the schema from the
 * migrations in git, then load this file back. Schema lives in version
 * control; this covers the half that doesn't.
 *
 *   DATABASE_URL="$NEON" node scripts/backup.mjs [outputPath]
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Ordered so a restore can insert parents before children.
const TABLES = [
  "admin", "artist", "user", "curatorApplication", "track", "fan",
  "fanSwipe", "swipe", "payment", "artistNotification",
  "curatorAssignment", "feature", "curatorPayout", "withdrawal",
  "errorLog", "adminLoginAttempt",
];

const data = {};
for (const t of TABLES) {
  data[t] = await prisma[t].findMany();
}

const out = process.argv[2] ?? `motr-backup-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(
  out,
  // BigInt and Date need coercing; JSON.stringify throws on the former.
  JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 2)
);

for (const [t, rows] of Object.entries(data)) {
  if (rows.length) console.log(`  ${String(rows.length).padStart(5)}  ${t}`);
}
console.log(`\nwritten to ${out}`);
await prisma.$disconnect();
