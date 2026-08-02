-- AlterTable
ALTER TABLE "CuratorApplication"
  ADD COLUMN "outletName" TEXT,
  ADD COLUMN "outletType" TEXT,
  ADD COLUMN "outletUrl" TEXT,
  ADD COLUMN "audienceSize" INTEGER,
  ADD COLUMN "socialLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "outletName" TEXT,
  ADD COLUMN "outletType" TEXT,
  ADD COLUMN "outletUrl" TEXT,
  ADD COLUMN "audienceSize" INTEGER,
  ADD COLUMN "socialLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];
