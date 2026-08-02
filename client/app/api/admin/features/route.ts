import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { FeatureError, rejectFeature, verifyFeature } from "@/lib/features";

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "SUBMITTED";
  const valid = ["SUBMITTED", "VERIFIED", "REJECTED"] as const;
  type S = (typeof valid)[number];

  const features = await prisma.feature.findMany({
    where: valid.includes(status as S) ? { status: status as S } : {},
    orderBy: { placedAt: "desc" },
    take: 100,
    include: {
      assignment: {
        include: {
          user: { select: { username: true, email: true } },
          track: { select: { title: true, artistName: true } },
        },
      },
      payout: { select: { amountCents: true, status: true } },
    },
  });

  // Surface whether the playlist hold has elapsed, so the UI doesn't have to
  // re-derive it.
  const now = new Date();
  return NextResponse.json({
    features: features.map((f) => ({ ...f, holdElapsed: f.holdUntil <= now })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { featureId, decision, reason } = await req.json();
  if (!featureId || (decision !== "VERIFY" && decision !== "REJECT")) {
    return NextResponse.json(
      { error: "featureId and decision ('VERIFY' | 'REJECT') are required" },
      { status: 400 }
    );
  }

  try {
    if (decision === "VERIFY") {
      const result = await verifyFeature(featureId);
      return NextResponse.json(result);
    }
    const feature = await rejectFeature(featureId, reason ?? "Rejected by admin");
    return NextResponse.json({ feature });
  } catch (e) {
    if (e instanceof FeatureError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}
