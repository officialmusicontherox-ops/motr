import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { pendingMilestones, sendMilestoneEmails } from "@/lib/artistMilestones";

/**
 * Artist progress emails — preview and send.
 *
 * Two verbs on purpose. GET shows exactly who would be written to and what
 * each of them would be told; POST actually sends. Mail to real artists is
 * the one thing in this dashboard that cannot be undone, so it is never the
 * side effect of opening a page.
 */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await pendingMilestones();
  return NextResponse.json({
    recipients: due,
    artists: due.length,
    tracks: due.reduce((n, r) => n + r.tracks.length, 0),
  });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl =
    process.env.APP_URL ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  const result = await sendMilestoneEmails(appUrl);
  return NextResponse.json(result);
}
