import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

/**
 * What is waiting for you, in one request.
 *
 * Each panel works out its own badge, but only once it has loaded, and a
 * collapsed panel never loads. So the dashboard could be sitting on three
 * failed submissions and an unresolved error and look identical to one with
 * nothing to do. These are the same numbers, fetched once, up front.
 *
 * Counts only. Anything that needs detail has a panel to open.
 */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [refusals, errors, untold, writeUps, unverified] = await Promise.all([
    prisma.refusedSubmission.count({ where: { status: "PENDING" } }),
    prisma.errorLog.count({ where: { resolved: false } }),
    prisma.artist.count({
      where: {
        emailOptOut: false,
        sharePageEmailAt: null,
        tracks: { some: { status: { not: "REJECTED" } } },
      },
    }),
    prisma.chartWinner.count({ where: { writeUpUrl: null } }),
    prisma.track.count({
      where: { status: { in: ["DISCOVERY", "VETTING", "GRADUATED"] }, audioVerdict: "MISMATCH" },
    }),
  ]);

  return NextResponse.json({
    items: [
      { key: "refusals", tab: "music", label: "failed submission", count: refusals, tone: "warn" },
      { key: "unverified", tab: "music", label: "wrong audio", count: unverified, tone: "bad" },
      { key: "untold", tab: "artists", label: "artist not told about their page", count: untold, tone: "info" },
      { key: "writeUps", tab: "charts", label: "write-up to do", count: writeUps, tone: "info" },
      { key: "errors", tab: "system", label: "unresolved error", count: errors, tone: "bad" },
    ].filter((i) => i.count > 0),
  });
}
