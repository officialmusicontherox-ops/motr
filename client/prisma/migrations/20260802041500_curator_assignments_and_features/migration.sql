-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'FEATURED', 'PASSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FeatureType" AS ENUM ('PLAYLIST', 'ARTICLE');

-- CreateEnum
CREATE TYPE "FeatureStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "CuratorPayout" ADD COLUMN     "featureId" TEXT;

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "genre" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "genres" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CuratorAssignment" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "CuratorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "type" "FeatureType" NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "holdUntil" TIMESTAMP(3) NOT NULL,
    "status" "FeatureStatus" NOT NULL DEFAULT 'SUBMITTED',
    "verifiedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuratorAssignment_userId_status_idx" ON "CuratorAssignment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CuratorAssignment_trackId_userId_key" ON "CuratorAssignment"("trackId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Feature_assignmentId_key" ON "Feature"("assignmentId");

-- CreateIndex
CREATE INDEX "Feature_status_idx" ON "Feature"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CuratorPayout_featureId_key" ON "CuratorPayout"("featureId");

-- AddForeignKey
ALTER TABLE "CuratorPayout" ADD CONSTRAINT "CuratorPayout_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuratorAssignment" ADD CONSTRAINT "CuratorAssignment_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuratorAssignment" ADD CONSTRAINT "CuratorAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CuratorAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

