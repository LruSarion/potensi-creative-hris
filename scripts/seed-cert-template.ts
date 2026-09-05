import { db } from "@/lib/db";

async function main() {
  await db.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "certificate_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
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
    "updatedAt" TIMESTAMP(3) NOT NULL
);
`);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "certificate_template_key_key" ON "certificate_template"("key");`);
  console.log("table ensured");

  // Use Prisma model if available, otherwise raw
  try {
    const existing = await (db as any).certificateTemplate?.findUnique?.({ where: { key: "default" } });
    console.log("existing", existing);
    if (!existing) {
      const now = new Date();
      await db.$executeRawUnsafe(`
        INSERT INTO "certificate_template" ("id","key","name","primaryColor","accentColor","backgroundColor","borderStyle","borderWidth","borderColor","headerTitle","headerSubtitle","bodyText","showWatermark","signatureName","signatureTitle","fontFamily","footerNote","isActive","createdAt","updatedAt")
        VALUES (gen_random_uuid()::text, 'default', 'Default Potensi Creative', '#065f46', '#0d9488', '#ffffff', 'double', 12, '#065f46', 'Sertifikat Kompetensi', 'Potensi Creative - Akademi Streamer', 'atas keberhasilan menyelesaikan seluruh modul pembelajaran dan ujian pada program', true, 'Trainer', 'Trainer Akademi', 'DM Sans', 'Verifikasi keaslian sertifikat melalui kode pada halaman ini.', true, NOW(), NOW())
        ON CONFLICT ("key") DO NOTHING
      `);
      console.log("seeded");
    }
  } catch (e) {
    console.error(e);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
