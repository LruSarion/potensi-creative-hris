/*
  Warnings:

  - Added the required column `courseId` to the `certificate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streamerKaryawanId` to the `certificate` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('OPEN', 'CLOSED', 'FILLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'PICKED', 'DECLINED');

-- AlterTable
ALTER TABLE "certificate" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "courseId" TEXT NOT NULL,
ADD COLUMN     "streamerKaryawanId" TEXT NOT NULL,
ADD COLUMN     "validTo" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "course" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "isCertification" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "streamer_profile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "karyawanId" TEXT NOT NULL,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "availability" TEXT NOT NULL DEFAULT 'FLEXIBLE',
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streamer_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "clientId" TEXT NOT NULL,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "platform" TEXT,
    "ratePerSesi" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quota" INTEGER NOT NULL DEFAULT 1,
    "status" "ListingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_application" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "streamerKaryawanId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "streamer_profile_karyawanId_key" ON "streamer_profile"("karyawanId");

-- CreateIndex
CREATE UNIQUE INDEX "project_application_listingId_streamerKaryawanId_key" ON "project_application"("listingId", "streamerKaryawanId");

-- CreateIndex
CREATE INDEX "certificate_streamerKaryawanId_clientId_idx" ON "certificate"("streamerKaryawanId", "clientId");

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_streamerKaryawanId_fkey" FOREIGN KEY ("streamerKaryawanId") REFERENCES "karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streamer_profile" ADD CONSTRAINT "streamer_profile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streamer_profile" ADD CONSTRAINT "streamer_profile_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing" ADD CONSTRAINT "marketplace_listing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing" ADD CONSTRAINT "marketplace_listing_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing" ADD CONSTRAINT "marketplace_listing_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_application" ADD CONSTRAINT "project_application_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_application" ADD CONSTRAINT "project_application_streamerKaryawanId_fkey" FOREIGN KEY ("streamerKaryawanId") REFERENCES "karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
