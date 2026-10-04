-- When an artist was told their page exists, so the announcement sends once.
ALTER TABLE "Artist" ADD COLUMN "sharePageEmailAt" TIMESTAMP(3);
