import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";
import { chartWinnerBoard, lockWeek } from "@/lib/chartWinners";

export const maxDuration = 60;

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ weeks: await chartWinnerBoard() });
}

/** Locks in a week's winner, or records the write-up once it's published. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, weekStart, winnerId, writeUpUrl, note } = await req.json().catch(() => ({}));

  if (action === "LOCK") {
    if (!weekStart) return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
    const winner = await lockWeek(new Date(weekStart));
    if (!winner) {
      return NextResponse.json(
        { error: "Nothing was saved that week, so there's no winner to lock in." },
        { status: 400 }
      );
    }
    return NextResponse.json({ winner });
  }

  if (action === "SET_WRITEUP") {
    if (!winnerId) return NextResponse.json({ error: "winnerId is required" }, { status: 400 });
    const winner = await prisma.chartWinner.update({
      where: { id: String(winnerId) },
      data: {
        writeUpUrl: typeof writeUpUrl === "string" && writeUpUrl.trim() ? writeUpUrl.trim() : null,
        note: typeof note === "string" && note.trim() ? note.trim() : null,
      },
    });
    return NextResponse.json({ winner });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
