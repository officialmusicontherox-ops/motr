import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tracks = await prisma.track.findMany({
    where: { status: "GRADUATED" },
    orderBy: [
      { performanceTier: "desc" },
      { publicStreamCount: "desc" },
      { approvalRatio: "desc" },
    ],
  });

  return NextResponse.json({ tracks });
}
