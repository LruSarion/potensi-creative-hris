-- CreateTable
CREATE TABLE "master_gaji" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "karyawanId" TEXT NOT NULL,
    "gajiPokok" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tunjTransport" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tunjMakan" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_gaji_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_gaji_karyawanId_key" ON "master_gaji"("karyawanId");

-- AlterTable: komponen gaji ref-deploy di payroll
ALTER TABLE "payroll" ADD COLUMN "gajiPokok" DECIMAL(14,2),
ADD COLUMN "tunjTransport" DECIMAL(14,2),
ADD COLUMN "tunjMakan" DECIMAL(14,2),
ADD COLUMN "totalTunjangan" DECIMAL(14,2),
ADD COLUMN "totalPotongan" DECIMAL(14,2),
ADD COLUMN "takeHomePay" DECIMAL(14,2),
ADD COLUMN "statusPersetujuan" TEXT NOT NULL DEFAULT 'MENUNGGU';

-- Backfill baris honor-tier lama: THP = grossPay agar tetap tampil di arsip
UPDATE "payroll" SET "takeHomePay" = "grossPay" WHERE "takeHomePay" IS NULL;
