import { NextResponse } from "next/server";

// Lightweight fan identity — username only, no password. Fans need an
// account (not full anonymity) so saved tracks can later be pushed to their
// own Spotify/Apple Music playlist.
/**
 * Listener accounts are made only by signing in, with Google or an emailed
 * link. This used to make anonymous listeners on request; since 26 November
 * 2026 the whole app is behind sign-in, so it refuses instead of quietly
 * adding listeners nobody can reach.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Sign in with Google or an email link to start listening." },
    { status: 403 }
  );
}

// There is deliberately no GET here.
//
// It used to list the fifty newest fans with no authentication and no select,
// which meant whole Fan rows: addresses, Google ids, and the Spotify access
// and refresh tokens. Nothing in the app ever called it; FanGate uses the POST
// above. A listing of everyone's accounts is not something this app needs to
// serve at all, so it is gone rather than guarded.
