import crypto from "crypto";
import { prisma } from "./prisma";
import { errorAlertEmail, sendEmail } from "./email";

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

/** Where alerts go. */
const ALERT_TO = process.env.ALERT_EMAIL ?? process.env.EMAIL_REPLY_TO ?? null;

/**
 * No more than this many alert emails in an hour.
 *
 * A single bad deploy can produce a dozen distinct faults at once. The cap is
 * the difference between being told and being buried, and anything held back
 * is still sitting in the admin log.
 */
const MAX_ALERTS_PER_HOUR = 4;

/**
 * Emails the operator, but only about something they have not been told.
 *
 * Three rules, each there for a reason:
 *  - A fault that has already sent an email does not send again, however many
 *    times it recurs. One scanner hitting three paths six times each would
 *    otherwise be eighteen emails.
 *  - A fault marked resolved that comes back does send again, because that is
 *    new information: the fix did not hold.
 *  - Four an hour, at most.
 *
 * Failure here is swallowed like everything else in this file. An alert that
 * cannot be sent must not take down the request that was already failing.
 */
async function maybeAlert(row: {
  id: string;
  message: string;
  source: string;
  path: string | null;
  method: string | null;
  stack: string | null;
  count: number;
  alertedAt: Date | null;
}, returning: boolean): Promise<void> {
  if (!ALERT_TO) return;
  if (row.alertedAt && !returning) return;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.errorLog.count({ where: { alertedAt: { gte: hourAgo } } });
  if (recent >= MAX_ALERTS_PER_HOUR) return;

  const mail = errorAlertEmail({
    message: row.message,
    source: row.source,
    path: row.path,
    method: row.method,
    stack: row.stack,
    count: row.count,
    returning,
  });

  // Stamped before sending, not after. If the send throws, a retry storm of
  // alerts about a failing mailer is the last thing a broken app needs.
  await prisma.errorLog.update({ where: { id: row.id }, data: { alertedAt: new Date() } });
  await sendEmail(ALERT_TO, mail);
}

export async function logError(report: ErrorReport): Promise<void> {
  try {
    const fingerprint = fingerprintOf(report);

    // Read first, so we can tell a new fault from a repeat, and a repeat from
    // something that was fixed and has come back. upsert alone cannot say.
    const before = await prisma.errorLog.findUnique({
      where: { fingerprint },
      select: { id: true, resolved: true, alertedAt: true },
    });

    const row = await prisma.errorLog.upsert({
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

    // A fault nobody has been told about, or one that was fixed and is back.
    const isNew = !before;
    const returned = Boolean(before?.resolved);
    if (isNew || returned) {
      await maybeAlert(
        { ...row, alertedAt: returned ? null : row.alertedAt },
        returned
      ).catch(() => {});
    }
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
