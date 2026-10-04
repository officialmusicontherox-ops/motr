import { NextResponse } from "next/server";
import { clearArtistSession } from "@/lib/artistAuth";

export async function POST() {
  await clearArtistSession();
  return NextResponse.json({ ok: true });
}
