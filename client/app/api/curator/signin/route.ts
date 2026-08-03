import { NextResponse } from "next/server";

/**
 * Retired on purpose.
 *
 * This used to accept an email and hand back that curator's account. It was
 * identification, not authentication: a curator's email is often public — on
 * a playlist bio or a blog contact page — so anyone who knew it could sign in
 * as them, change the payout address on the earnings screen, and request a
 * cashout. Curators now sign in with Google, which actually proves they own
 * the address.
 *
 * The route stays so an old client gets a clear explanation rather than a 404.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Curator sign-in now uses Google. Open the Curate page and choose Continue with Google, using the email on your application.",
    },
    { status: 410 }
  );
}
