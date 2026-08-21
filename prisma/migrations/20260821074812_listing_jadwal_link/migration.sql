-- AlterTable
ALTER TABLE "marketplace_listing" ADD COLUMN     "jadwalId" TEXT;

-- AddForeignKey
ALTER TABLE "marketplace_listing" ADD CONSTRAINT "marketplace_listing_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "jadwal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
