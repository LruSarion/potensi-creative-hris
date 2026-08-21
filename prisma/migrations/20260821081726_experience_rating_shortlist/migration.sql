-- AlterTable
ALTER TABLE "streamer_experience" ADD COLUMN     "clientRating" DECIMAL(3,2),
ADD COLUMN     "clientTestimonial" TEXT;

-- CreateTable
CREATE TABLE "client_shortlist" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "streamerKaryawanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_shortlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_shortlist_clientId_streamerKaryawanId_key" ON "client_shortlist"("clientId", "streamerKaryawanId");

-- AddForeignKey
ALTER TABLE "client_shortlist" ADD CONSTRAINT "client_shortlist_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_shortlist" ADD CONSTRAINT "client_shortlist_streamerKaryawanId_fkey" FOREIGN KEY ("streamerKaryawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
