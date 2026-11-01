import { NextRequest, NextResponse } from "next/server";
import { artistUnsubscribeToken } from "@/lib/nudges";
import { optOutArtist } from "@/lib/optOut";

/**
 * The artist's confirmed unsubscribe.
 *
 * A listener's link acts on one click, because an unsubscribe that asks for
 * anything first is one that does not work. An artist's cannot: the same
 * click takes their music off the platform, and a stray tap in a mail app
 * should not empty somebody's catalogue. So the link shows what will happen
 * and this is the button.
 *
 * Still one page and no sign-in, so it stays as easy as it has to be.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const artistId = String(form?.get("artist") ?? "");
  const token = String(form?.get("t") ?? "");

  const back = (params: string) => NextResponse.redirect(new URL(`/unsubscribe?${params}`, req.url), 303);

  if (!artistId || token !== artistUnsubscribeToken(artistId)) {
    return back("state=invalid");
  }

  try {
    const { tracksPulled } = await optOutArtist(artistId, "link");
    return back(`state=artist&pulled=${tracksPulled}`);
  } catch {
    return back("state=invalid");
  }
}
