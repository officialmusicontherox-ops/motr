import { NextRequest, NextResponse } from "next/server";
import { consumeScoutToken } from "@/lib/scoutLoginLink";
import { createScoutSession } from "@/lib/scoutAuth";

/** Spends a sign-in link and starts the session. POST, so mail scanners can't burn it. */
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));

  const scoutId = await consumeScoutToken(typeof token === "string" ? token : "");
  if (!scoutId) {
    return NextResponse.json(
      { error: "That link has expired or was already used. Ask for a new one." },
      { status: 400 }
    );
  }

  await createScoutSession(scoutId);
  return NextResponse.json({ ok: true });
}
