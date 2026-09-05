-- CreateTable
CREATE TABLE "master_libur_periode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "periode" TEXT NOT NULL,
    "kebutuhanJam" INTEGER NOT NULL DEFAULT 0,
    "kuotaHarian" INTEGER NOT NULL DEFAULT 4,
    "floorKuota" INTEGER NOT NULL DEFAULT 1,
    "blackoutDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kuotaOverrides" JSONB,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_libur_periode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_libur_periode_tenantId_periode_key" ON "master_libur_periode"("tenantId", "periode");
CREATE INDEX "master_libur_periode_periode_idx" ON "master_libur_periode"("periode");

-- AlterTable (PenilaianSDM.periode index)
CREATE INDEX "penilaian_sdm_periode_idx" ON "penilaian_sdm"("periode");
