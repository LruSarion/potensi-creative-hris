-- CreateEnum
CREATE TYPE "RevenueSource" AS ENUM ('BITS', 'GIFT', 'SUBSCRIPTION', 'BRAND_DEAL', 'OTHER');

-- CreateTable
CREATE TABLE "revenue_entry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "jadwalId" TEXT,
    "streamerKaryawanId" TEXT,
    "clientId" TEXT,
    "source" "RevenueSource" NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "agencyCut" DECIMAL(14,2) NOT NULL,
    "streamerCut" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_entry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "revenue_entry" ADD CONSTRAINT "revenue_entry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_entry" ADD CONSTRAINT "revenue_entry_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "jadwal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
