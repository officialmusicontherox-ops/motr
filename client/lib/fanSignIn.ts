import { prisma } from "./prisma";

/**
 * Finds or makes the listener account for a verified address, and folds in
 * the anonymous session this browser had, if any. Shared by Google sign-in
 * and the email sign-in link, so both end up in the same account.
 */
export async function signInFan(email: string, name: string | undefined, mergeFanId?: string) {
  const existing = await prisma.fan.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  const fan =
    existing ??
    (await prisma.fan.create({
      data: {
        email,
        displayName: name ?? null,
        username: `${(name ?? email.split("@")[0]).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "listener"}${Math.random().toString(36).slice(2, 6)}`,
      },
    }));

  if (mergeFanId && mergeFanId !== fan.id) {
    const anon = await prisma.fan.findUnique({ where: { id: mergeFanId } });
    // Only ever absorb a genuinely anonymous session, never another account.
    if (anon && !anon.email && !anon.spotifyId) {
      const swipes = await prisma.fanSwipe.findMany({ where: { fanId: mergeFanId } });
      for (const s of swipes) {
        await prisma.fanSwipe
          .update({ where: { id: s.id }, data: { fanId: fan.id } })
          .catch(async () => {
            // Already swiped that track on the signed-in account — the
            // anonymous copy is redundant.
            await prisma.fanSwipe.delete({ where: { id: s.id } }).catch(() => {});
          });
      }
      await prisma.fan.delete({ where: { id: mergeFanId } }).catch(() => {});
    }
  }

  return fan;
}
