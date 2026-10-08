import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Counts a page view.
 *
 * A Fan record only exists once somebody presses a button, so until this
 * existed the app could not tell the difference between nobody visiting and
 * everybody leaving. This closes that gap and nothing else: it stores a random
 * cookie id, the path, the referring host and a country, and is never joined
 * to a Fan, an email or a swipe.
 */

const COOKIE = "motr_v";
const YEAR = 60 * 60 * 24 * 365;

/** Crawlers would otherwise be most of the number and none of the answer. */
const BOT =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|preview|monitor|uptime|headless|lighthouse|pingdom|curl|wget|python-requests|axios|postman|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|claudebot|ccbot/i;

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return NextResponse.json({ ok: true, counted: false });

  const body = await req.json().catch(() => ({}));
  const rawPath = typeof body.path === "string" ? body.path : "/";
  // Our own paths only, length-capped: this value is written to a table that
  // the admin panel renders.
  const path = rawPath.startsWith("/") ? rawPath.slice(0, 120) : "/";

  // Host only. The full URL of the page someone was reading before is more
  // than we need to answer "where does traffic come from".
  let referrer: string | null = null;
  if (typeof body.referrer === "string" && body.referrer) {
    try {
      const h = new URL(body.referrer).hostname;
      if (!h.endsWith("musicontherox.com")) referrer = h.slice(0, 120);
    } catch {
      // A referrer that will not parse tells us nothing; drop it.
    }
  }

  const existing = req.cookies.get(COOKIE)?.value;
  const visitorId = existing && existing.length <= 64 ? existing : randomUUID();

  const country =
    req.headers.get("x-nf-client-connection-country") ??
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;

  await prisma.visit
    .create({
      data: {
        visitorId,
        path,
        referrer,
        country: country?.slice(0, 2).toUpperCase() ?? null,
        fromShare: Boolean(body.fromShare),
        isNew: !existing,
      },
    })
    // A counter must never be the reason a page breaks.
    .catch(() => {});

  const res = NextResponse.json({ ok: true, counted: true });
  if (!existing) {
    res.cookies.set(COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: YEAR,
    });
  }
  return res;
}
