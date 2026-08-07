import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { curatorApprovedEmail, curatorDeclinedEmail, sendEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  const valid = ["PENDING", "APPROVED", "DECLINED"] as const;
  type AppStatus = (typeof valid)[number];

  const applications = await prisma.curatorApplication.findMany({
    where: valid.includes(status as AppStatus) ? { status: status as AppStatus } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ applications });
}

// Approving an application creates the actual curator User account.
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { applicationId, decision, note } = await req.json();
  const decisions = ["APPROVE", "DECLINE", "RESEND_WELCOME"];
  if (!applicationId || !decisions.includes(decision)) {
    return NextResponse.json(
      { error: `applicationId and decision (${decisions.join(" | ")}) are required` },
      { status: 400 }
    );
  }

  const application = await prisma.curatorApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // Sending again is the whole recovery path for a welcome email that bounced
  // or never went out — without it, an approved curator who got nothing has no
  // way of learning the job exists.
  if (decision === "RESEND_WELCOME") {
    if (application.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only an approved application has a welcome email to resend." },
        { status: 409 }
      );
    }
    const mail = await sendEmail(
      application.email,
      curatorApprovedEmail(application.username, application.email)
    );
    return NextResponse.json({ emailed: mail.ok, emailError: mail.error });
  }

  if (application.status !== "PENDING") {
    return NextResponse.json(
      { error: `This application is already ${application.status}` },
      { status: 409 }
    );
  }

  if (decision === "DECLINE") {
    const declined = await prisma.curatorApplication.update({
      where: { id: applicationId },
      data: { status: "DECLINED", reviewedAt: new Date(), reviewNote: note ?? null },
    });
    const mail = await sendEmail(declined.email, curatorDeclinedEmail(declined.username));
    return NextResponse.json({ application: declined, user: null, emailed: mail.ok });
  }

  // Approve: create the curator and link it back to the application, so a
  // half-applied state can't exist if either write fails.
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: application.email,
        username: application.username,
        // Carry everything over so the curator record still shows who they
        // are and what they run long after the application is filed away.
        genres: application.genres,
        outletName: application.outletName,
        outletType: application.outletType,
        outletUrl: application.outletUrl,
        audienceSize: application.audienceSize,
        country: application.country,
        socialLinks: application.socialLinks,
      },
    });
    const approved = await tx.curatorApplication.update({
      where: { id: applicationId },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewNote: note ?? null,
        createdUserId: user.id,
      },
    });
    return { application: approved, user };
  });

  // Sent after the transaction commits — an email failure must not undo an
  // approval that already succeeded.
  const mail = await sendEmail(
    result.user.email,
    curatorApprovedEmail(result.user.username, result.user.email)
  );

  return NextResponse.json({ ...result, emailed: mail.ok, emailError: mail.error });
}
