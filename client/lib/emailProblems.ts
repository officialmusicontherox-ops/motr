import { prisma } from "./prisma";
import { logError } from "./errorLog";

/**
 * Write down an email that did not reach someone.
 *
 * Never throws: recording a failure must not turn into a second failure for
 * whatever was sending. One row per event, kept short.
 */
export async function recordEmailProblem(params: {
  email: string;
  kind: "refused" | "bounced" | "complained" | "failed" | "suppressed";
  reason?: string | null;
  subject?: string | null;
}) {
  const email = params.email.trim().toLowerCase();
  if (!email) return;
  // An address on the opt-out list is one we have retired on purpose, such
  // as an artist's old address after they gave us a new one. Nothing is
  // sent there any more, so a late bounce for mail sent before the change
  // is not a problem to show or alert on.
  const retired = await prisma.suppressedEmail
    .findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })
    .catch(() => null);
  if (retired) return;
  await prisma.emailProblem
    .create({
      data: {
        email,
        kind: params.kind,
        reason: params.reason ? params.reason.slice(0, 300) : null,
        subject: params.subject ? params.subject.slice(0, 200) : null,
      },
    })
    .catch(() => {});

  // Into the error log as well, worded without the address, so each new
  // kind of problem sends the usual alert email once and repeats only add
  // to its count. Not for "suppressed": that is Resend declining an address
  // it already knows is dead, which is expected, and alerting on it every
  // time a batch went out was noise.
  if (params.kind === "suppressed") return;
  await logError({
    source: "SERVER",
    path: "email",
    message: `Email ${params.kind}: ${(params.reason ?? "no reason given").slice(0, 160)}`,
  }).catch(() => {});
}

/**
 * Whether an address is known not to receive mail: Resend has reported it
 * bounced, marked as spam, or on its block list. Such an address is skipped
 * quietly by bulk sends instead of being tried, refused and recorded again
 * every time. A corrected address on the account is a different address,
 * so fixing a typo clears this on its own.
 */
export async function isUndeliverable(email: string): Promise<boolean> {
  const address = email.trim().toLowerCase();
  if (!address) return false;
  const hit = await prisma.emailProblem
    .findFirst({
      where: { email: address, kind: { in: ["bounced", "complained", "suppressed"] } },
      select: { id: true },
    })
    .catch(() => null);
  return Boolean(hit);
}
