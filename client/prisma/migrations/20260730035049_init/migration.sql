-- CreateEnum
CREATE TYPE "TrackSource" AS ENUM ('SPOTIFY', 'APPLE_MUSIC');

-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('VETTING', 'GRADUATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SwipeDirection" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "PerformanceTier" AS ENUM ('NONE', 'GOOD', 'EXCEPTIONAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "totalSwipes" INTEGER NOT NULL DEFAULT 0,
    "rightSwipesOnGraduated" INTEGER NOT NULL DEFAULT 0,
    "curationWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "source" "TrackSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "isrc" TEXT,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "albumName" TEXT,
    "artworkUrl" TEXT,
    "previewUrl" TEXT NOT NULL,
    "durationMs" INTEGER,
    "submittedById" TEXT,
    "status" "TrackStatus" NOT NULL DEFAULT 'VETTING',
    "requiredListenThreshold" INTEGER NOT NULL DEFAULT 50,
    "totalListens" INTEGER NOT NULL DEFAULT 0,
    "rightSwipes" INTEGER NOT NULL DEFAULT 0,
    "leftSwipes" INTEGER NOT NULL DEFAULT 0,
    "consecutiveRightSwipes" INTEGER NOT NULL DEFAULT 0,
    "approvalRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "graduatedAt" TIMESTAMP(3),
    "publicStreamCount" INTEGER NOT NULL DEFAULT 0,
    "publicLikeCount" INTEGER NOT NULL DEFAULT 0,
    "performanceTier" "PerformanceTier" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Swipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "direction" "SwipeDirection" NOT NULL,
    "listenDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Swipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Track_source_externalId_key" ON "Track"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Swipe_userId_trackId_key" ON "Swipe"("userId", "trackId");

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
