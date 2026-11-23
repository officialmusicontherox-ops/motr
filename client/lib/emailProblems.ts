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
  // to its count. Without this the list sat in the admin panel unnoticed.
  await logError({
    source: "SERVER",
    path: "email",
    message: `Email ${params.kind}: ${(params.reason ?? "no reason given").slice(0, 160)}`,
  }).catch(() => {});
}
