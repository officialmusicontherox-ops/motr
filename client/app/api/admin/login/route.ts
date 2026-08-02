import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAdminSession, verifyTotp } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const { email, password, totp } = await req.json();
  if (!email || !password || !totp) {
    return NextResponse.json(
      { error: "email, password, and totp are required" },
      { status: 400 }
    );
  }

  const admin = await prisma.admin.findUnique({ where: { email } });

  // Same generic message + a hash comparison on the miss path, so a wrong
  // email and a wrong password are indistinguishable in response or timing.
  const fallbackHash = "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
  const passwordOk = await bcrypt.compare(password, admin?.passwordHash ?? fallbackHash);
  const totpOk = admin ? await verifyTotp(admin.totpSecret, String(totp)) : false;

  if (!admin || !passwordOk || !totpOk) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await createAdminSession(admin.id);
  return NextResponse.json({ ok: true, admin: { id: admin.id, email: admin.email } });
}
