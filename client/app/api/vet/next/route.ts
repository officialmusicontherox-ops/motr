import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }

  const track = await prisma.track.findFirst({
    where: {
      status: "VETTING",
      swipes: { none: { userId } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!track) {
    return NextResponse.json({ track: null });
  }

  return NextResponse.json({ track });
}
