import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/errorLog";
import { allowRequest, tooManyRequests } from "@/lib/rateLimit";

/**
 * Where the browser reports errors a user actually hit.
 *
 * Public by necessity — the people hitting errors aren't signed in — so it
 * assumes everything it receives is untrusted: fields are length-capped, the
 * path comes from the request rather than the body, and it always answers OK
 * so a failure here never cascades into the page that's already broken.
 */
export async function POST(req: NextRequest) {
  // Always answers OK, so a limited caller is simply ignored rather than
  // told it was — this endpoint must never make a broken page worse.
  const gate = await allowRequest("errorReport", req);
  if (!gate.allowed) return NextResponse.json({ ok: true });

  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    // Browser extensions and cancelled navigations generate constant noise
    // that says nothing about the app.
    const noise = [
      "ResizeObserver loop",
      "Script error",
      "Load failed",
      "NetworkError when attempting to fetch",
      "The operation was aborted",
      "cancelled",
    ];
    if (!message || noise.some((n) => message.toLowerCase().includes(n.toLowerCase()))) {
      return NextResponse.json({ ok: true });
    }

    await logError({
      source: "CLIENT",
      message: message.slice(0, 1000),
      path: typeof body?.path === "string" ? body.path.slice(0, 500) : null,
      stack: typeof body?.stack === "string" ? body.stack.slice(0, 4000) : null,
      digest: typeof body?.digest === "string" ? body.digest.slice(0, 100) : null,
      userAgent: req.headers.get("user-agent"),
    });
  } catch {
    // Never let reporting an error become an error.
  }

  return NextResponse.json({ ok: true });
}
