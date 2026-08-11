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
    paypalOk,
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
  // Curating is open worldwide. PayPal reaches 190+ countries, but what it
  // allows differs in each one — some can receive USD without being able to
  // withdraw it locally, and a few are blocked outright. Keeping that list
  // accurate is not a job worth having, so the applicant confirms their own
  // account can take a USD payment and PayPal remains the authority: if it
  // can't be paid, the payout fails rather than the application being wrong.
  if (String(country ?? "").trim().length < 2) {
    return NextResponse.json({ error: "Tell us which country you're in." }, { status: 400 });
  }
  if (!paypalOk) {
    return NextResponse.json(
      { error: "Payouts are sent in USD via PayPal, so you need an account that can receive them." },
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
        country: String(country).trim().slice(0, 60),
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
