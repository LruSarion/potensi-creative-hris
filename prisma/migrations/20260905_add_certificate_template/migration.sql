-- CreateTable
CREATE TABLE "certificate_template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Potensi Creative',
    "primaryColor" TEXT NOT NULL DEFAULT '#065f46',
    "accentColor" TEXT NOT NULL DEFAULT '#0d9488',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "borderStyle" TEXT NOT NULL DEFAULT 'double',
    "borderWidth" INTEGER NOT NULL DEFAULT 12,
    "borderColor" TEXT NOT NULL DEFAULT '#065f46',
    "logoDriveId" TEXT,
    "backgroundDriveId" TEXT,
    "headerTitle" TEXT NOT NULL DEFAULT 'Sertifikat Kompetensi',
    "headerSubtitle" TEXT NOT NULL DEFAULT 'Potensi Creative - Akademi Streamer',
    "bodyText" TEXT DEFAULT 'atas keberhasilan menyelesaikan seluruh modul pembelajaran dan ujian pada program',
    "showWatermark" BOOLEAN NOT NULL DEFAULT true,
    "signatureName" TEXT NOT NULL DEFAULT 'Trainer',
    "signatureTitle" TEXT NOT NULL DEFAULT 'Trainer Akademi',
    "fontFamily" TEXT NOT NULL DEFAULT 'DM Sans',
    "footerNote" TEXT DEFAULT 'Verifikasi keaslian sertifikat melalui kode pada halaman ini.',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "certificate_template_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "certificate_template_key_key" ON "certificate_template"("key");