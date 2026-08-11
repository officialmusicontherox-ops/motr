import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { unsubscribeToken } from "@/lib/nudges";

export const metadata = { title: "Unsubscribe — MOTR" };

/**
 * One click, no sign-in, no confirmation step.
 *
 * An unsubscribe that asks someone to log in first is an unsubscribe that
 * doesn't work, and the complaint that follows costs more than the address
 * was worth. The link is HMAC-signed so it can only ever opt out the person
 * it was sent to.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ fan?: string; t?: string }>;
}) {
  const { fan: fanId, t } = await searchParams;

  const signed = Boolean(fanId && t && t === unsubscribeToken(fanId));
  const state: "done" | "invalid" = signed
    ? await prisma.fan
        .update({ where: { id: fanId! }, data: { emailOptOut: true } })
        .then(() => "done" as const)
        .catch(() => "invalid" as const)
    : "invalid";

  return (
    <main className="bg-bg flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl uppercase tracking-wide">
        {state === "done" ? "Unsubscribed" : "Link not recognised"}
      </h1>
      <p className="text-muted max-w-sm text-sm leading-relaxed">
        {state === "done"
          ? "That's done — we won't send you any more reminder emails. Your account and everything you've saved are untouched, and you can swipe whenever you like."
          : "That unsubscribe link isn't valid. It may have already been used, or been cut short by your email app. Reply to any MOTR email and we'll take you off by hand."}
      </p>
      <Link
        href="/"
        className="bg-gold text-bg mt-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide"
      >
        Back to MOTR
      </Link>
    </main>
  );
}
