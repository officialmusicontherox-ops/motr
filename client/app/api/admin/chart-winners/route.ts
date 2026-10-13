import { NextRequest, NextResponse } from "next/server";
import { CHART_START, CHART_START_LABEL } from "@/lib/weekWindow";
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
    // Belt and braces: the board no longer offers these, but a stale tab could
    // still post one, and that is how the October row got in.
    if (new Date(weekStart) < CHART_START) {
      return NextResponse.json(
        { error: `The chart starts on ${CHART_START_LABEL}. Earlier weeks have no winner.` },
        { status: 400 }
      );
    }
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
