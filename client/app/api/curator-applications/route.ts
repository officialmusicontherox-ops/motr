import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Public: anyone can apply to become a curator. An admin reviews it later.
export async function POST(req: NextRequest) {
  const {
    email,
    username,
    pitch,
    genres,
    outletName,
    outletType,
    outletUrl,
    audienceSize,
    socialLinks,
    country,
  } = await req.json();

  if (!email || !username || !pitch) {
    return NextResponse.json(
      { error: "email, username, and pitch are required" },
      { status: 400 }
    );
  }
  // The outlet is the thing an approval decision actually rests on, so it
  // can't be skipped.
  if (!outletName || !outletType || !outletUrl) {
    return NextResponse.json(
      { error: "Tell us what you run: outlet name, type, and a link to it." },
      { status: 400 }
    );
  }
  if (!/^https?:\/\/.+\..+/i.test(String(outletUrl).trim())) {
    return NextResponse.json(
      { error: "That outlet link doesn't look like a valid URL." },
      { status: 400 }
    );
  }
  // Payouts run through PayPal US, so we can't onboard curators we can't pay.
  if (String(country ?? "").trim().toUpperCase() !== "US") {
    return NextResponse.json(
      { error: "Curator payouts are US-only right now, so we can only take US-based applicants." },
      { status: 400 }
    );
  }
  if (!Array.isArray(genres) || genres.length === 0) {
    return NextResponse.json({ error: "Pick at least one genre you cover." }, { status: 400 });
  }
  if (String(pitch).trim().length < 20) {
    return NextResponse.json(
      { error: "Tell us a bit more — at least 20 characters." },
      { status: 400 }
    );
  }

  // Don't let someone apply for a username/email already curating.
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existingUser) {
    return NextResponse.json(
      { error: "That email or username is already a curator." },
      { status: 409 }
    );
  }

  try {
    const application = await prisma.curatorApplication.create({
      data: {
        email: String(email).trim().toLowerCase(),
        username: String(username).trim(),
        pitch,
        genres: genres.filter((g: unknown) => typeof g === "string"),
        outletName: String(outletName).trim(),
        outletType: String(outletType).trim(),
        outletUrl: String(outletUrl).trim(),
        audienceSize:
          typeof audienceSize === "number" && Number.isFinite(audienceSize)
            ? Math.max(0, Math.round(audienceSize))
            : null,
        socialLinks: Array.isArray(socialLinks)
          ? socialLinks.filter((s: unknown) => typeof s === "string").slice(0, 6)
          : [],
        country: "US",
      },
    });
    return NextResponse.json({ application }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "You've already applied with that email or username." },
        { status: 409 }
      );
    }
    throw e;
  }
}
