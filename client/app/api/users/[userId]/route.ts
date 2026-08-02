import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Restore a curator session from a stored id, without exposing the whole
// user list to the client.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

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
