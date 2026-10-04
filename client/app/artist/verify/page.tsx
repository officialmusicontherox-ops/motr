import Link from "next/link";
import { peekArtistToken } from "@/lib/artistLoginLink";
import ConfirmArtistSignIn from "./ConfirmArtistSignIn";

export const metadata = { title: "Sign in — MOTR", robots: { index: false, follow: false } };

/**
 * Where an artist's sign-in link lands.
 *
 * The token is checked but not spent: a link that signs you in on sight is a
 * link a mail scanner burns before the artist ever clicks it.
 */
export default async function ArtistVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await peekArtistToken(token) : null;

  return (
    <main className="bg-bg text-ink flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      {valid ? (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">You&apos;re nearly in</h1>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            Signing in as <span className="text-ink">{valid.email}</span>.
          </p>
          <ConfirmArtistSignIn token={token!} />
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl uppercase tracking-wide">Link expired</h1>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            Sign-in links last 30 minutes and work once. Ask for a fresh one.
          </p>
          <Link
            href="/artist"
            className="bg-gold text-bg rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wide"
          >
            Get a new link
          </Link>
        </>
      )}
    </main>
  );
}
