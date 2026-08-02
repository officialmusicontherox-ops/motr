-- AlterTable
ALTER TABLE "CuratorApplication" ADD COLUMN "genres" TEXT[] DEFAULT ARRAY[]::TEXT[];
