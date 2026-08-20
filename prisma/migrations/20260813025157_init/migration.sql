-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'CLIENT', 'STREAMER', 'STAFF', 'OTS');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('LAKI_LAKI', 'PEREMPUAN');

-- CreateEnum
CREATE TYPE "StatusAktif" AS ENUM ('AKTIF', 'NON_AKTIF');

-- CreateEnum
CREATE TYPE "TipeJadwal" AS ENUM ('OFFICE_HOURS', 'SHIFT', 'LIVE');

-- CreateEnum
CREATE TYPE "StatusJadwal" AS ENUM ('TERJADWAL', 'PENDING', 'APPROVED', 'REJECTED', 'SELESAI', 'DIBATALKAN');

-- CreateEnum
CREATE TYPE "StatusApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TipeAbsensi" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "KategoriAbsensi" AS ENUM ('STREAMER', 'STAFF', 'OTS');

-- CreateEnum
CREATE TYPE "StatusLembur" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StatusIzin" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StatusTukarShift" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StatusProduk" AS ENUM ('DRAFT', 'APPROVED', 'ONLINE', 'CLEANING', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "pinHash" TEXT,
    "pinSalt" TEXT,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karyawan" (
    "id" TEXT NOT NULL,
    "idKaryawan" TEXT NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "namaPanggilan" TEXT,
    "gender" "Gender",
    "jabatan" TEXT,
    "kategori" TEXT,
    "tipeJadwal" "TipeJadwal",
    "nomorTelepon" TEXT,
    "email" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "statusAktif" "StatusAktif" NOT NULL DEFAULT 'AKTIF',
    "nik" TEXT,
    "npwp" TEXT,
    "statusPtkp" TEXT,
    "alamatKtp" TEXT,
    "alamatDomisili" TEXT,
    "tempatLahir" TEXT,
    "tanggalLahir" TIMESTAMP(3),
    "statusPerkawinan" TEXT,
    "agama" TEXT,
    "riwayatPenyakit" TEXT,
    "emergencyContact" TEXT,
    "scanKtpDriveId" TEXT,
    "scanKkDriveId" TEXT,
    "scanNpwpDriveId" TEXT,
    "namaBank" TEXT,
    "nomorRekening" TEXT,
    "namaPemilikRek" TEXT,
    "linkFolder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "karyawan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "namaClient" TEXT NOT NULL,
    "platform" TEXT,
    "pic" TEXT,
    "kontak" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_ketentuan" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "blacklist" TEXT,
    "prioritasPlatform" TEXT,

    CONSTRAINT "client_ketentuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produk" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "namaProduk" TEXT NOT NULL,
    "kategori" TEXT,
    "harga" DECIMAL(12,2),
    "status" "StatusProduk" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal" (
    "id" TEXT NOT NULL,
    "idJadwal" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "platform" TEXT,
    "idHost" TEXT,
    "hostKaryawanId" TEXT,
    "streamerKaryawanId" TEXT,
    "idOts" TEXT,
    "otsKaryawanId" TEXT,
    "cabangStudio" TEXT,
    "nomorStudio" TEXT,
    "jamMulaiLive" TIMESTAMP(3) NOT NULL,
    "jamSelesaiLive" TIMESTAMP(3) NOT NULL,
    "status" "StatusJadwal" NOT NULL DEFAULT 'TERJADWAL',
    "produkPrioritas" TEXT,
    "keperluanOts" TEXT,
    "judulLive" TEXT,
    "promoLive" TEXT,
    "catatanHost" TEXT,
    "catatanOts" TEXT,
    "filePendukungHostDriveId" TEXT,
    "filePendukungOtsDriveId" TEXT,
    "periodeBulan" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jadwal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absensi" (
    "id" TEXT NOT NULL,
    "karyawanId" TEXT NOT NULL,
    "jadwalId" TEXT,
    "tipe" "TipeAbsensi" NOT NULL,
    "kategori" "KategoriAbsensi" NOT NULL,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buktiDriveId" TEXT,
    "catatan" TEXT,

    CONSTRAINT "absensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lembur" (
    "id" TEXT NOT NULL,
    "karyawanId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "jamMulai" TIMESTAMP(3) NOT NULL,
    "jamSelesai" TIMESTAMP(3) NOT NULL,
    "alasan" TEXT,
    "buktiDriveId" TEXT,
    "status" "StatusLembur" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lembur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "izin" (
    "id" TEXT NOT NULL,
    "karyawanId" TEXT NOT NULL,
    "tanggalMulai" TIMESTAMP(3) NOT NULL,
    "tanggalSelesai" TIMESTAMP(3) NOT NULL,
    "jenis" TEXT,
    "alasan" TEXT,
    "lampiranDriveId" TEXT,
    "status" "StatusIzin" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "izin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tukar_shift" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "jadwalId" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "alasan" TEXT,
    "lampiranDriveId" TEXT,
    "status" "StatusTukarShift" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tukar_shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penilaian_sdm" (
    "id" TEXT NOT NULL,
    "karyawanId" TEXT NOT NULL,
    "penilaiId" TEXT NOT NULL,
    "skor" INTEGER NOT NULL,
    "komentar" TEXT,
    "periode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penilaian_sdm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiering" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "jamMinimal" INTEGER NOT NULL,
    "jamMaksimal" INTEGER NOT NULL,
    "ratePerJam" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll" (
    "id" TEXT NOT NULL,
    "karyawanId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "totalJam" DECIMAL(10,2) NOT NULL,
    "tier" TEXT,
    "ratePerJam" DECIMAL(12,2) NOT NULL,
    "grossPay" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kuota_host" (
    "id" TEXT NOT NULL,
    "karyawanId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "kuota" INTEGER NOT NULL,
    "terpakai" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kuota_host_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "libur_streamer" (
    "id" TEXT NOT NULL,
    "karyawanId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "alasan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "libur_streamer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_aktivitas" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "aksi" TEXT NOT NULL,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_aktivitas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "karyawan_idKaryawan_key" ON "karyawan"("idKaryawan");

-- CreateIndex
CREATE UNIQUE INDEX "karyawan_userId_key" ON "karyawan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "client_ketentuan_clientId_platform_key" ON "client_ketentuan"("clientId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "jadwal_idJadwal_key" ON "jadwal"("idJadwal");

-- CreateIndex
CREATE INDEX "jadwal_tanggal_idx" ON "jadwal"("tanggal");

-- CreateIndex
CREATE INDEX "jadwal_streamerKaryawanId_idx" ON "jadwal"("streamerKaryawanId");

-- CreateIndex
CREATE INDEX "absensi_karyawanId_waktu_idx" ON "absensi"("karyawanId", "waktu");

-- CreateIndex
CREATE UNIQUE INDEX "tiering_tier_key" ON "tiering"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_karyawanId_periode_key" ON "payroll"("karyawanId", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "kuota_host_karyawanId_periode_key" ON "kuota_host"("karyawanId", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "libur_streamer_karyawanId_tanggal_key" ON "libur_streamer"("karyawanId", "tanggal");

-- CreateIndex
CREATE INDEX "log_aktivitas_userId_createdAt_idx" ON "log_aktivitas"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "karyawan" ADD CONSTRAINT "karyawan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ketentuan" ADD CONSTRAINT "client_ketentuan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produk" ADD CONSTRAINT "produk_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_hostKaryawanId_fkey" FOREIGN KEY ("hostKaryawanId") REFERENCES "karyawan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_streamerKaryawanId_fkey" FOREIGN KEY ("streamerKaryawanId") REFERENCES "karyawan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_otsKaryawanId_fkey" FOREIGN KEY ("otsKaryawanId") REFERENCES "karyawan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "jadwal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembur" ADD CONSTRAINT "lembur_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin" ADD CONSTRAINT "izin_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tukar_shift" ADD CONSTRAINT "tukar_shift_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tukar_shift" ADD CONSTRAINT "tukar_shift_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penilaian_sdm" ADD CONSTRAINT "penilaian_sdm_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuota_host" ADD CONSTRAINT "kuota_host_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libur_streamer" ADD CONSTRAINT "libur_streamer_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_aktivitas" ADD CONSTRAINT "log_aktivitas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
