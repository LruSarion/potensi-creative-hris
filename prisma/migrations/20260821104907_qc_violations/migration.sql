-- CreateEnum
CREATE TYPE "ViolationCategory" AS ENUM ('GROOMING', 'ATTITUDE', 'LANGUAGE', 'DRESS_CODE', 'PRODUCT_HANDLING', 'PLATFORM_RULE', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "qc_violation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "jadwalId" TEXT,
    "streamerKaryawanId" TEXT NOT NULL,
    "category" "ViolationCategory" NOT NULL,
    "severity" "ViolationSeverity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT,
    "photoUrl" TEXT,
    "capturedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_violation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qc_violation_streamerKaryawanId_createdAt_idx" ON "qc_violation"("streamerKaryawanId", "createdAt");

-- AddForeignKey
ALTER TABLE "qc_violation" ADD CONSTRAINT "qc_violation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_violation" ADD CONSTRAINT "qc_violation_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "jadwal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_violation" ADD CONSTRAINT "qc_violation_streamerKaryawanId_fkey" FOREIGN KEY ("streamerKaryawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
