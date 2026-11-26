import Link from "next/link";
import { peekFanToken } from "@/lib/fanLoginLink";
import { safeNext } from "@/lib/safeNext";
import ConfirmFanSignIn from "./ConfirmFanSignIn";

export const metadata = { title: "Sign in — MOTR", robots: { index: false, follow: false } };

/**
 * Where a listener's emailed sign-in link lands.
 *
 * Checked but not spent until the button is pressed: a link that signs you
 * in on sight is one a mail scanner uses up before the listener clicks it.
 */
export default async function FanVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const { token, next } = await searchParams;
  const valid = token ? await peekFanToken(token) : null;
  const to = safeNext(next);

  return (
    <main className="bg-bg text-ink flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      {valid ? (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">You&apos;re nearly in</h1>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            Signing in as <span className="text-ink">{valid.email}</span>.
          </p>
          <ConfirmFanSignIn token={token!} next={to} />
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">Link expired</h1>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            Sign-in links last 30 minutes and work once. Ask for a fresh one.
          </p>
          <Link
            href={to}
            className="bg-gold text-bg rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wide"
          >
            Get a new link
          </Link>
        </>
      )}
    </main>
  );
}
