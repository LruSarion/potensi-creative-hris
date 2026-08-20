-- AlterEnum
ALTER TYPE "PayoutRunStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "payout_line" ADD COLUMN     "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "streamerCut" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payout_run" ADD COLUMN     "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0;
