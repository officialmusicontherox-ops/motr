import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateSecret, generateURI } from "otplib";
import qrcode from "qrcode";

process.loadEnvFile(".env");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Royalty-free preview clips, standing in for real Spotify/Apple Music
// preview_url values until real catalog credentials are wired up.
const SAMPLE_PREVIEWS = [
  "https://filesamples.com/samples/audio/mp3/sample3.mp3",
  "https://filesamples.com/samples/audio/mp3/sample4.mp3",
  "https://filesamples.com/samples/audio/mp3/sample1.mp3",
];

async function main() {
  const curators = await Promise.all(
    ["ava", "kenji", "priya"].map((username) =>
      prisma.user.upsert({
        where: { email: `${username}@example.com` },
        update: {},
        create: { email: `${username}@example.com`, username },
      })
    )
  );

  const tracks = [
    { title: "Neon Skyline", artistName: "The Wavelengths", requiredListenThreshold: 3 },
    { title: "Concrete Bloom", artistName: "Marisol Vega", requiredListenThreshold: 3 },
    { title: "Static & Gold", artistName: "Ochre Room", requiredListenThreshold: 50 },
  ];

  for (const [i, t] of tracks.entries()) {
    await prisma.track.upsert({
      where: { source_externalId: { source: "SPOTIFY", externalId: `seed-${i}` } },
      update: {},
      create: {
        source: "SPOTIFY",
        externalId: `seed-${i}`,
        title: t.title,
        artistName: t.artistName,
        previewUrl: SAMPLE_PREVIEWS[i % SAMPLE_PREVIEWS.length],
        requiredListenThreshold: t.requiredListenThreshold,
        submittedById: curators[i % curators.length].id,
      },
    });
  }

  console.log(`Seeded ${curators.length} users and ${tracks.length} tracks.`);

  const adminEmail = "jerrettfranklinmusic@gmail.com";
  const existingAdmin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const generatedPassword = crypto.randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(generatedPassword, 12);
    const totpSecret = generateSecret();
    const otpauthUri = generateURI({ issuer: "Music Discovery Admin", label: adminEmail, secret: totpSecret });

    await prisma.admin.create({ data: { email: adminEmail, passwordHash, totpSecret } });

    const qr = await qrcode.toString(otpauthUri, { type: "terminal", small: true });
    console.log(
      `\nAdmin account created:\n  email:    ${adminEmail}\n  password: ${generatedPassword}\n` +
        `(Password shown once here — change it after first login; there is no reset flow yet.)\n\n` +
        `Scan this into Google Authenticator (or any TOTP app):\n${qr}\n` +
        `If you can't scan, enter this key manually: ${totpSecret}\n`
    );
  } else {
    console.log("Admin account already exists — skipping.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
