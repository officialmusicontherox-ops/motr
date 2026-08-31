import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { createScoutLoginToken } from "@/lib/scoutLoginLink";
import { sendEmail, scoutLoginLinkEmail } from "@/lib/email";

/** The A&R accounts, newest first. */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scouts = await prisma.scout.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, name: true, company: true,
      status: true, lastSeenAt: true, createdAt: true,
    },
  });
  return NextResponse.json({ scouts });
}

/** Creates an account and emails them a sign-in link. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, company } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "A name is required." }, { status: 400 });
  }
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const normalised = email.trim().toLowerCase();
  const existing = await prisma.scout.findUnique({ where: { email: normalised } });
  if (existing) {
    return NextResponse.json({ error: "That address already has access." }, { status: 409 });
  }

  const scout = await prisma.scout.create({
    data: {
      name: name.trim(),
      email: normalised,
      company: typeof company === "string" && company.trim() ? company.trim() : null,
    },
  });

  // Invite immediately: an account nobody has been told about is just a row.
  const link = await createScoutLoginToken(normalised);
  let invited = false;
  if (link.ok) {
    const appUrl = process.env.APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const sent = await sendEmail(
      link.email,
      scoutLoginLinkEmail({
        name: link.name,
        url: `${appUrl}/scout/verify?token=${encodeURIComponent(link.token)}`,
        minutes: 15,
      })
    );
    invited = sent.ok;
  }

  return NextResponse.json({ scout, invited });
}

/** Suspends, reinstates, or re-invites. */
export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scoutId, action } = await req.json().catch(() => ({}));
  const scout = await prisma.scout.findUnique({ where: { id: String(scoutId ?? "") } });
  if (!scout) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "suspend" || action === "reinstate") {
    const updated = await prisma.scout.update({
      where: { id: scout.id },
      data: { status: action === "suspend" ? "SUSPENDED" : "ACTIVE" },
    });
    return NextResponse.json({ scout: updated });
  }

  if (action === "resend") {
    const link = await createScoutLoginToken(scout.email);
    if (!link.ok) {
      return NextResponse.json(
        {
          error:
            link.reason === "throttled"
              ? "They've already been sent several links this hour. Try again later."
              : "That account isn't active.",
        },
        { status: 400 }
      );
    }
    const appUrl = process.env.APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const sent = await sendEmail(
      link.email,
      scoutLoginLinkEmail({
        name: link.name,
        url: `${appUrl}/scout/verify?token=${encodeURIComponent(link.token)}`,
        minutes: 15,
      })
    );
    return NextResponse.json({ sent: sent.ok });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
