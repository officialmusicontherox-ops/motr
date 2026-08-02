import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FeatureError, passOnAssignment, submitFeature } from "@/lib/features";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  const valid = ["PENDING", "FEATURED", "PASSED", "EXPIRED"] as const;
  type S = (typeof valid)[number];

  const assignments = await prisma.curatorAssignment.findMany({
    where: {
      userId,
      ...(valid.includes(status as S) ? { status: status as S } : {}),
    },
    orderBy: { assignedAt: "desc" },
    include: {
      track: {
        select: {
          id: true,
          title: true,
          artistName: true,
          artworkUrl: true,
          previewUrl: true,
          genre: true,
        },
      },
      feature: true,
    },
  });

  return NextResponse.json({ assignments });
}

// Curator decides: share it (with proof) or pass.
export async function POST(req: NextRequest) {
  const { userId, assignmentId, action, type, proofUrl } = await req.json();

  if (!userId || !assignmentId) {
    return NextResponse.json({ error: "userId and assignmentId are required" }, { status: 400 });
  }

  try {
    if (action === "PASS") {
      const assignment = await passOnAssignment(assignmentId, userId);
      return NextResponse.json({ assignment });
    }

    if (action === "FEATURE") {
      if (!["PLAYLIST", "VIDEO", "ARTICLE"].includes(type) || !proofUrl) {
        return NextResponse.json(
          { error: "type ('PLAYLIST' | 'VIDEO' | 'ARTICLE') and proofUrl are required to share" },
          { status: 400 }
        );
      }
      const feature = await submitFeature({ assignmentId, userId, type, proofUrl });
      return NextResponse.json({ feature });
    }

    return NextResponse.json(
      { error: "action must be 'FEATURE' or 'PASS'" },
      { status: 400 }
    );
  } catch (e) {
    if (e instanceof FeatureError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}
