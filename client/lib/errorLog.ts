import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * Recording what went wrong, for the admin dashboard.
 *
 * Two rules shape this:
 *
 *  - Logging must never break the thing it's logging. Every failure here is
 *    swallowed, because an error while recording an error would replace a
 *    small problem with an outage.
 *  - Repeats collapse onto one row. A single broken page can throw thousands
 *    of identical errors, and a log that buries yesterday's real bug under
 *    them is worse than no log.
 */

export type ErrorReport = {
  source: "SERVER" | "CLIENT";
  message: string;
  path?: string | null;
  method?: string | null;
  stack?: string | null;
  digest?: string | null;
  userAgent?: string | null;
};

/** Strips the parts that vary run to run, so the same bug lands on one row. */
function fingerprintOf(r: ErrorReport): string {
  const stable = [
    r.source,
    r.path?.split("?")[0] ?? "",
    r.message
      // ids, uuids and numbers differ per request but mean the same fault
      .replace(/[0-9a-f]{8,}/gi, "<id>")
      .replace(/\d+/g, "<n>")
      .slice(0, 200),
  ].join("|");
  return crypto.createHash("sha1").update(stable).digest("hex");
}

export async function logError(report: ErrorReport): Promise<void> {
  try {
    const fingerprint = fingerprintOf(report);

    await prisma.errorLog.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        source: report.source,
        message: report.message.slice(0, 1000),
        path: report.path?.slice(0, 500) ?? null,
        method: report.method ?? null,
        stack: report.stack?.slice(0, 4000) ?? null,
        digest: report.digest ?? null,
        userAgent: report.userAgent?.slice(0, 300) ?? null,
      },
      update: {
        count: { increment: 1 },
        lastSeen: new Date(),
        // Something recurring after being marked fixed isn't fixed.
        resolved: false,
      },
    });
  } catch {
    // Deliberately silent — see the note at the top of this file.
  }
}

/**
 * Keeps the table from growing without bound. Resolved entries are only
 * useful for a short while, and anything untouched for months is noise.
 */
export async function pruneErrors(): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  try {
    await prisma.errorLog.deleteMany({
      where: { OR: [{ resolved: true, lastSeen: { lt: cutoff } }, { lastSeen: { lt: cutoff } }] },
    });
  } catch {
    // Non-critical.
  }
}
