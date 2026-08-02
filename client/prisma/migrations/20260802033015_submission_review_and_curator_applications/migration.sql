-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CuratorApplication" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuratorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuratorApplication_email_key" ON "CuratorApplication"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CuratorApplication_username_key" ON "CuratorApplication"("username");

-- CreateIndex
CREATE UNIQUE INDEX "CuratorApplication_createdUserId_key" ON "CuratorApplication"("createdUserId");
