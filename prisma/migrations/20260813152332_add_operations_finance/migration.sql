-- CreateEnum
CREATE TYPE "SessionLiveState" AS ENUM ('SCHEDULED', 'LIVE', 'REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RosterStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutRunStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID');

-- CreateTable
CREATE TABLE "session_state_log" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "jadwalId" TEXT NOT NULL,
    "fromState" "SessionLiveState",
    "toState" "SessionLiveState" NOT NULL,
    "changedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_state_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "jadwalId" TEXT,
    "streamerKaryawanId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeId" TEXT,
    "reportedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_shift" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "karyawanId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "jamMulai" TIMESTAMP(3) NOT NULL,
    "jamSelesai" TIMESTAMP(3) NOT NULL,
    "role" TEXT,
    "status" "RosterStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_run" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "periode" TEXT NOT NULL,
    "status" "PayoutRunStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_line" (
    "id" TEXT NOT NULL,
    "payoutRunId" TEXT NOT NULL,
    "karyawanId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_doc" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "clientId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_doc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_line" (
    "id" TEXT NOT NULL,
    "billingDocId" TEXT NOT NULL,
    "jadwalId" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_state_log_jadwalId_createdAt_idx" ON "session_state_log"("jadwalId", "createdAt");

-- CreateIndex
CREATE INDEX "incident_status_severity_idx" ON "incident"("status", "severity");

-- CreateIndex
CREATE INDEX "incident_tenantId_createdAt_idx" ON "incident"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "roster_shift_karyawanId_tanggal_key" ON "roster_shift"("karyawanId", "tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "payout_run_tenantId_periode_key" ON "payout_run"("tenantId", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "billing_doc_clientId_periode_key" ON "billing_doc"("clientId", "periode");

-- AddForeignKey
ALTER TABLE "session_state_log" ADD CONSTRAINT "session_state_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_state_log" ADD CONSTRAINT "session_state_log_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "jadwal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "jadwal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_streamerKaryawanId_fkey" FOREIGN KEY ("streamerKaryawanId") REFERENCES "karyawan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "karyawan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_shift" ADD CONSTRAINT "roster_shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_shift" ADD CONSTRAINT "roster_shift_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_run" ADD CONSTRAINT "payout_run_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_payoutRunId_fkey" FOREIGN KEY ("payoutRunId") REFERENCES "payout_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_doc" ADD CONSTRAINT "billing_doc_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_doc" ADD CONSTRAINT "billing_doc_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_line" ADD CONSTRAINT "billing_line_billingDocId_fkey" FOREIGN KEY ("billingDocId") REFERENCES "billing_doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_line" ADD CONSTRAINT "billing_line_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "jadwal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
