import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/adminAuth";

export async function GET() {
  const adminId = await getAdminSession();
  if (!adminId) {
    return NextResponse.json({ admin: null }, { status: 401 });
  }

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, email: true },
  });

  return NextResponse.json({ admin });
}
