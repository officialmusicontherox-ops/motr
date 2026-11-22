import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { recordEmailProblem } from "@/lib/emailProblems";

/**
 * Resend telling MOTR that an email did not land.
 *
 * MOTR's Resend key can only send, so it cannot look up what happened to a
 * message afterwards. A bounce, a spam complaint, a failure or a
 * suppression arrives here instead, signed by Resend, and is recorded for
 * the admin panel's "Emails that did not arrive" list. Every other event is
 * acknowledged and ignored.
 *
 * Needs RESEND_WEBHOOK_SECRET, the signing secret Resend shows when the
 * webhook is created. Without it nothing is accepted.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const payload = await req.text();
  let event: { type: string; data?: Record<string, unknown> };
  try {
    event = new Resend(process.env.RESEND_API_KEY ?? "re_unused").webhooks.verify({
      payload,
      // Resend signs with the svix-* headers.
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    }) as unknown as typeof event;
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  const kinds = {
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.failed": "failed",
    "email.suppressed": "suppressed",
  } as const;
  const kind = kinds[event.type as keyof typeof kinds];
  if (!kind || !event.data) return NextResponse.json({ ok: true });

  const d = event.data as {
    to?: string[];
    subject?: string;
    bounce?: { message?: string };
    failed?: { reason?: string };
    suppressed?: { message?: string; type?: string };
  };
  const reason =
    d.bounce?.message ?? d.failed?.reason ?? d.suppressed?.message ?? d.suppressed?.type ?? null;
  for (const to of d.to ?? []) {
    await recordEmailProblem({ email: to, kind, reason, subject: d.subject ?? null });
  }
  return NextResponse.json({ ok: true });
}
