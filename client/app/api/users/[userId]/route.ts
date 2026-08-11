import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurator } from "@/lib/curatorAuth";

// Restore a curator session from a stored id, without exposing the whole
// user list to the client.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  // This returns the curator's email, so it can't answer to anyone holding
  // an id — ids travel in redirect URLs and browser history. Only the signed
  // session gets an answer, and only about itself.
  const auth = await requireCurator(userId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      curationWeight: true,
      totalSwipes: true,
      rightSwipesOnGraduated: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}
