import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Minimal dev-only user creation until real auth is wired up.
export async function POST(req: NextRequest) {
  const { email, username } = await req.json();
  if (!email || !username) {
    return NextResponse.json({ error: "email and username are required" }, { status: 400 });
  }

  const user = await prisma.user.create({ data: { email, username } });
  return NextResponse.json({ user }, { status: 201 });
}

export async function GET() {
  const users = await prisma.user.findMany({ orderBy: { curationWeight: "desc" } });
  return NextResponse.json({ users });
}
