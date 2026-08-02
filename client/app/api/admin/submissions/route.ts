import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { assignCuratorsToTrack } from "@/lib/assignments";

// Artist submissions that have been paid for and are waiting on an admin
// decision before they reach the curator vetting pool.
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  const valid = ["PENDING", "APPROVED", "DECLINED"] as const;
  type Review = (typeof valid)[number];

  const submissions = await prisma.track.findMany({
    where: valid.includes(status as Review) ? { reviewStatus: status as Review } : {},
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      artist: { select: { name: true, email: true } },
      payment: { select: { amountCents: true, currency: true, status: true } },
    },
  });

  return NextResponse.json({ submissions });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { trackId, decision, note } = await req.json();
  if (!trackId || (decision !== "APPROVE" && decision !== "DECLINE")) {
    return NextResponse.json(
      { error: "trackId and decision ('APPROVE' | 'DECLINE') are required" },
      { status: 400 }
    );
  }

  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (track.reviewStatus !== "PENDING") {
    return NextResponse.json(
      { error: `This submission is already ${track.reviewStatus}` },
      { status: 409 }
    );
  }

  const approved = decision === "APPROVE";
  const updated = await prisma.track.update({
    where: { id: trackId },
    data: {
      reviewStatus: approved ? "APPROVED" : "DECLINED",
      // Approving releases it to curators; declining ends its run.
      status: approved ? "VETTING" : "REJECTED",
      reviewedAt: new Date(),
      reviewNote: note ?? null,
    },
  });

  // Approving is what actually routes the track out to curators.
  const assignment = approved ? await assignCuratorsToTrack(trackId) : null;

  return NextResponse.json({ track: updated, assignment });
}
