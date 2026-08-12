import Link from "next/link";
import { peekLoginToken } from "@/lib/curatorLoginLink";
import ConfirmSignIn from "./ConfirmSignIn";

export const metadata = { title: "Sign in — MOTR" };

/**
 * Where a sign-in link lands.
 *
 * The token is checked here but not spent: signing in on sight would mean a
 * corporate mail scanner following the link before the curator ever sees it,
 * burning a one-time token and greeting them with "expired" on their first
 * and only click. One button costs a second and makes the difference between
 * working and looking broken for anyone behind a filter.
 */
export default async function CuratorSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await peekLoginToken(token) : null;

  return (
    <main className="bg-bg flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      {valid ? (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">You&apos;re nearly in</h1>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            Signing in as <span className="text-white">{valid.email}</span>.
          </p>
          <ConfirmSignIn token={token!} />
          <p className="text-muted max-w-xs text-xs leading-relaxed">
            This link works once. After you&apos;re in you&apos;ll stay signed in on this device
            for 30 days.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">Link expired</h1>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            Sign-in links last 15 minutes and work once. Ask for a fresh one and it&apos;ll be in
            your inbox in a few seconds.
          </p>
          <Link
            href="/curate"
            className="bg-gold text-bg rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide"
          >
            Get a new link
          </Link>
        </>
      )}
    </main>
  );
}
