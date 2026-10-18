import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Turns away writes aimed at pages.
 *
 * Scanners POST to "/", "/api" and "/app" looking for something to talk to.
 * None of those accept a POST, and two of them are not pages at all, but
 * Next.js still tried to render its error page for them and threw
 * "Expected RSC response, got text/plain" doing it. Six of those landed in
 * the error log from one scanner, three times over, which buries anything
 * real underneath.
 *
 * Answering 405 ends it before rendering begins, which is also the honest
 * reply: the method is not allowed here.
 *
 * Safe because nothing in this app POSTs to a page. There are no Server
 * Actions, which post to the page's own URL, and every form is handled in
 * the client and calls an /api route. Should a Server Action ever be added,
 * this has to allow POST for whatever page hosts it.
 */
export function proxy(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return NextResponse.next();
  }

  return new NextResponse(null, {
    status: 405,
    headers: { allow: "GET, HEAD, OPTIONS" },
  });
}

export const config = {
  // Everything except the API, Next's own assets and the files at the root
  // that crawlers ask for. The API is excluded because that is where every
  // real POST in this app goes.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};
