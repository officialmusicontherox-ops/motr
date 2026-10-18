import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Pool settings for a function that gets frozen between requests.
 *
 * "Connection terminated unexpectedly" turned up twice in four days, both
 * times on a cron route. Those run on a schedule, so the function is cold or
 * just thawed, and a socket the pool opened before the freeze is dead by the
 * time anything asks for it again. Holding fewer connections for a shorter
 * time means there is less to go stale, and a connection timeout means a bad
 * one fails quickly rather than hanging the whole run.
 *
 * It reduces the odds rather than removing them: a pool cannot run its idle
 * timer while the process is frozen. Both crons repeat on their own, so a
 * missed run costs nothing but the log line.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
