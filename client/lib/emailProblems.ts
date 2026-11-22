import { prisma } from "./prisma";

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
}
