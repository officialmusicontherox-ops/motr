import Link from "next/link";
import { peekScoutToken } from "@/lib/scoutLoginLink";
import ConfirmScoutSignIn from "./ConfirmScoutSignIn";

export const metadata = { title: "Sign in — MOTR A&R" };

/**
 * Where an A&R sign-in link lands.
 *
 * The token is checked but not spent — see the curator equivalent for why a
 * link that signs you in on sight is a link corporate mail filters destroy
 * before you ever click it.
 */
export default async function ScoutVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await peekScoutToken(token) : null;

  return (
    <main className="bg-bg flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      {valid ? (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">You&apos;re nearly in</h1>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            Signing in as <span className="text-white">{valid.email}</span>.
          </p>
          <ConfirmScoutSignIn token={token!} />
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">Link expired</h1>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            Sign-in links last 15 minutes and work once. Ask for a fresh one.
          </p>
          <Link
            href="/scout"
            className="bg-gold text-bg rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wide"
          >
            Get a new link
          </Link>
        </>
      )}
    </main>
  );
}
