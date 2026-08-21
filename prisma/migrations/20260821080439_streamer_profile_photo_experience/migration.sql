-- AlterTable
ALTER TABLE "streamer_profile" ADD COLUMN     "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "streamer_experience" (
    "id" TEXT NOT NULL,
    "streamerProfileId" TEXT NOT NULL,
    "clientId" TEXT,
    "jadwalId" TEXT,
    "title" TEXT NOT NULL,
    "platform" TEXT,
    "periode" TEXT,
    "result" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streamer_experience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "streamer_experience_streamerProfileId_idx" ON "streamer_experience"("streamerProfileId");

-- AddForeignKey
ALTER TABLE "streamer_experience" ADD CONSTRAINT "streamer_experience_streamerProfileId_fkey" FOREIGN KEY ("streamerProfileId") REFERENCES "streamer_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streamer_experience" ADD CONSTRAINT "streamer_experience_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streamer_experience" ADD CONSTRAINT "streamer_experience_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "jadwal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
