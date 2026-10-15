import { NextRequest, NextResponse } from "next/server";

/**
 * Temporary: reports which geo-ish headers the platform actually sends.
 *
 * The visit counter guessed at three header names and got none of them, so
 * rather than guess a fourth, this shows what is really on the request.
 * Returns header names and values only for geo/location fields, never
 * cookies or authorization.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const interesting = /geo|country|city|region|latitude|longitude|timezone|^x-nf|^x-vercel|^cf-/i;
  const seen: Record<string, string> = {};
  const all: string[] = [];
  req.headers.forEach((v, k) => {
    all.push(k);
    if (interesting.test(k) && !/cookie|auth|token|key/i.test(k)) {
      seen[k] = v.slice(0, 200);
    }
  });
  return NextResponse.json({ geoHeaders: seen, allHeaderNames: all.sort() });
}
