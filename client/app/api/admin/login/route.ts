import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAdminSession, verifyTotp } from "@/lib/adminAuth";
import { checkLoginThrottle, clientIp, recordLoginAttempt } from "@/lib/loginThrottle";

export async function POST(req: NextRequest) {
  const { email, password, totp } = await req.json();
  if (!email || !password || !totp) {
    return NextResponse.json(
      { error: "email, password, and totp are required" },
      { status: 400 }
    );
  }

  const ip = clientIp(req);
  const normalizedEmail = String(email).trim().toLowerCase();

  // Checked before any credential work: this endpoint shouldn't double as a
  // way to burn our CPU on bcrypt either.
  const throttle = await checkLoginThrottle(ip, normalizedEmail);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many failed attempts. This is locked for 15 minutes — wait, then try again." },
      { status: 429, headers: { "retry-after": String(throttle.retryAfterSeconds) } }
    );
  }

  const admin = await prisma.admin.findUnique({ where: { email: normalizedEmail } });

  // Same generic message + a hash comparison on the miss path, so a wrong
  // email and a wrong password are indistinguishable in response or timing.
  const fallbackHash = "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
  const passwordOk = await bcrypt.compare(password, admin?.passwordHash ?? fallbackHash);

  const code = String(totp).trim();
  const totpOk = admin ? await verifyTotp(admin.totpSecret, code) : false;

  // A TOTP code stays valid for its whole window, so the same six digits
  // could be replayed by anyone who read them over a shoulder or out of a log.
  const replayed =
    admin?.lastTotpCode === code &&
    admin.lastTotpAt != null &&
    Date.now() - admin.lastTotpAt.getTime() < 120_000;

  const ua = req.headers.get("user-agent");

  if (!admin || !passwordOk || !totpOk || replayed) {
    await recordLoginAttempt({ ip, email: normalizedEmail, success: false, userAgent: ua });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastTotpCode: code, lastTotpAt: new Date() },
  });

  await recordLoginAttempt({ ip, email: normalizedEmail, success: true, userAgent: ua });
  await createAdminSession(admin.id);

  return NextResponse.json({ ok: true, admin: { id: admin.id, email: admin.email } });
}
