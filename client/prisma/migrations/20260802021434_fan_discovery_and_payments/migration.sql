-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED');

-- AlterEnum
ALTER TYPE "TrackStatus" ADD VALUE 'DISCOVERY';

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "artistId" TEXT,
ADD COLUMN     "fanLeftSwipes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fanRightSwipes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "feeStatus" "FeeStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "requiredFanApprovals" INTEGER NOT NULL DEFAULT 100,
ALTER COLUMN "status" SET DEFAULT 'DISCOVERY';

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fan" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanSwipe" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "direction" "SwipeDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanSwipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistNotification" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SUBMIT_TO_CURATORS_FEE_REQUEST',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artist_email_key" ON "Artist"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Fan_username_key" ON "Fan"("username");

-- CreateIndex
CREATE UNIQUE INDEX "FanSwipe_fanId_trackId_key" ON "FanSwipe"("fanId", "trackId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_trackId_key" ON "Payment"("trackId");

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanSwipe" ADD CONSTRAINT "FanSwipe_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanSwipe" ADD CONSTRAINT "FanSwipe_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistNotification" ADD CONSTRAINT "ArtistNotification_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistNotification" ADD CONSTRAINT "ArtistNotification_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
