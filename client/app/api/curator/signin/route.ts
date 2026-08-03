import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Curators identify themselves by the email they applied with. Approving an
 * application is what creates the account, so there's no self-signup here.
 *
 * NOTE: this is identification, not authentication — anyone who knows a
 * curator's email could sign in as them. Real sessions are the outstanding
 * auth work; this at least removes the public account picker that let anyone
 * click into anyone else's queue and earnings.
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Enter the email you applied with." }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: {
      id: true, username: true, email: true, curationWeight: true,
      status: true,
    },
  });

  if (user) {
    // A suspended or removed curator keeps their record (payouts reference
    // it) but must not get back into the queue or their earnings screen.
    if (user.status === "SUSPENDED" || user.status === "REMOVED") {
      return NextResponse.json(
        {
          error:
            "This account isn't active. If you think that's a mistake, reply to any MOTR email and we'll take a look.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ user });
  }

  // Distinguish "still waiting on us" from "never applied" — otherwise a
  // pending applicant thinks something is broken.
  const application = await prisma.curatorApplication.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { status: true },
  });

  if (application?.status === "PENDING") {
    return NextResponse.json(
      { error: "Your application is still being reviewed. We'll email you when it's approved." },
      { status: 403 }
    );
  }
  if (application?.status === "DECLINED") {
    return NextResponse.json(
      { error: "That application wasn't approved this time." },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { error: "No curator account with that email yet." },
    { status: 404 }
  );
}
