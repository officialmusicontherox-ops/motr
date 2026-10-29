import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { previewShareBlast, sendShareBlast } from "@/lib/shareBlast";

/**
 * The share cards, to every artist.
 *
 * GET says who it would reach; POST sends one batch and reports how far
 * along the send is, so the dashboard calls it until it says done. Mail to
 * every artist is not something that should happen as a side effect of
 * opening a page.
 *
 * No maxDuration here on purpose: that is a Vercel setting and Netlify pays
 * no attention to it. This function gets about ten seconds whatever it says,
 * which is why the send is batched.
 */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await previewShareBlast());
}

export async function POST() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendShareBlast());
}
