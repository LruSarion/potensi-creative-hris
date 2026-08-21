import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateSalt, hashPin } from "../src/lib/pin";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding HRIS demo data...");

  // --- Tenants (multi-tenant core) ---
  const agency = await prisma.tenant.upsert({
    where: { id: "tenant-agency" },
    update: { name: "Potensi Creative", type: "AGENCY" },
    create: { id: "tenant-agency", name: "Potensi Creative", type: "AGENCY" },
  });
  const brand = await prisma.tenant.upsert({
    where: { id: "tenant-brand1" },
    update: { name: "Demo Brand (Client)", type: "CLIENT_BRAND" },
    create: { id: "tenant-brand1", name: "Demo Brand (Client)", type: "CLIENT_BRAND" },
  });
  console.log(`  tenants: ${agency.name} + ${brand.name}`);

  // --- Tiering bands (from legacy master_tiering.json) ---
  const tiering = [
    { tier: "Basic", jamMinimal: 1, jamMaksimal: 80, ratePerJam: 25000 },
    { tier: "Standard", jamMinimal: 81, jamMaksimal: 120, ratePerJam: 27500 },
    { tier: "Optimal", jamMinimal: 121, jamMaksimal: 155, ratePerJam: 28500 },
    { tier: "Advance", jamMinimal: 156, jamMaksimal: 208, ratePerJam: 30000 },
    { tier: "High Performer", jamMinimal: 209, jamMaksimal: 999, ratePerJam: 35000 },
  ];
  for (const t of tiering) {
    await prisma.tiering.upsert({
      where: { tier: t.tier },
      update: { ...t, tenantId: agency.id },
      create: { ...t, tenantId: agency.id },
    });
  }
  console.log(`  tiering: ${tiering.length} bands`);

  // --- Demo users (one per role) with hashed PINs ---
  const demoUsers = [
    { email: "admin@potensicreative.test", name: "Admin Utama", role: "SUPER_ADMIN", pin: "1234", tenantId: agency.id },
    { email: "ops@potensicreative.test", name: "Ops Lead", role: "OPERATION", pin: "1234", tenantId: agency.id },
    { email: "trainer@potensicreative.test", name: "Trainer Utama", role: "TRAINER", pin: "1234", tenantId: agency.id },
    { email: "qc@potensicreative.test", name: "QC Reviewer", role: "QC_REVIEWER", pin: "1234", tenantId: agency.id },
    { email: "qc-manager@potensicreative.test", name: "QC Manager", role: "QC_MANAGER", pin: "1234", tenantId: agency.id },
    { email: "finance@potensicreative.test", name: "Finance Staff", role: "FINANCE", pin: "1234", tenantId: agency.id },
    { email: "finance-manager@potensicreative.test", name: "Finance Manager", role: "FINANCE_MANAGER", pin: "1234", tenantId: agency.id },
    { email: "client@potensicreative.test", name: "Client Demo", role: "CLIENT", pin: "1234", tenantId: brand.id },
    { email: "client-admin@potensicreative.test", name: "Client Admin", role: "CLIENT_ADMIN", pin: "1234", tenantId: brand.id },
    { email: "streamer@potensicreative.test", name: "Streamer Demo", role: "STREAMER", pin: "1234", tenantId: agency.id },
    { email: "staff@potensicreative.test", name: "Staff Demo", role: "STAFF", pin: "1234", tenantId: agency.id },
    { email: "ots@potensicreative.test", name: "OTS Demo", role: "OTS", pin: "1234", tenantId: agency.id },
  ];

  for (const u of demoUsers) {
    const salt = generateSalt();
    const pinHash = hashPin(u.pin, salt);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role as never, pinHash, pinSalt: salt, tenantId: u.tenantId },
      create: {
        email: u.email,
        name: u.name,
        role: u.role as never,
        pinHash,
        pinSalt: salt,
        tenantId: u.tenantId,
      },
    });
  }
  console.log(`  users: ${demoUsers.length} (PIN demo: 1234)`);

  // --- Demo karyawan linked to users (agency tenant) ---
  const karyawanSeed = [
    { idKaryawan: "PCS001", namaLengkap: "Admin Utama", email: "admin@potensicreative.test", jabatan: "Direktur", kategori: "Management", tipeJadwal: "OFFICE_HOURS" },
    { idKaryawan: "PCS002", namaLengkap: "Streamer Demo", email: "streamer@potensicreative.test", jabatan: "Streamer", kategori: "Streamer", tipeJadwal: "LIVE" },
    { idKaryawan: "PCS003", namaLengkap: "Staff Demo", email: "staff@potensicreative.test", jabatan: "Staff", kategori: "Staff", tipeJadwal: "OFFICE_HOURS" },
    { idKaryawan: "PCS004", namaLengkap: "OTS Demo", email: "ots@potensicreative.test", jabatan: "OTS", kategori: "OTS", tipeJadwal: "SHIFT" },
    { idKaryawan: "PCS005", namaLengkap: "Ops Lead", email: "ops@potensicreative.test", jabatan: "Operation Lead", kategori: "Operation", tipeJadwal: "OFFICE_HOURS" },
  ];
  for (const k of karyawanSeed) {
    const user = await prisma.user.findUnique({ where: { email: k.email } });
    await prisma.karyawan.upsert({
      where: { idKaryawan: k.idKaryawan },
      update: { namaLengkap: k.namaLengkap, userId: user?.id, tenantId: agency.id },
      create: {
        idKaryawan: k.idKaryawan,
        namaLengkap: k.namaLengkap,
        jabatan: k.jabatan,
        kategori: k.kategori,
        tipeJadwal: k.tipeJadwal as never,
        userId: user?.id,
        tenantId: agency.id,
      },
    });
  }
  console.log(`  karyawan: ${karyawanSeed.length}`);

  // --- Demo client + produk (brand tenant) ---
  const client = await prisma.client.upsert({
    where: { id: "demo-client" },
    update: { namaClient: "Vegeta Shopee", tenantId: brand.id },
    create: { id: "demo-client", namaClient: "Vegeta Shopee", platform: "Shopee", pic: "Christian Ronald", tenantId: brand.id },
  });
  await prisma.produk.upsert({
    where: { id: "demo-produk" },
    update: { namaProduk: "Produk Demo", tenantId: brand.id },
    create: { id: "demo-produk", clientId: client.id, namaProduk: "Produk Demo", kategori: "FMCG", harga: 50000, tenantId: brand.id },
  });
  console.log("  client + produk: 1 each");

  // --- LMS Courses & Modules & Questions ---
  const course = await prisma.course.upsert({
    where: { id: "course-onboarding-01" },
    update: {
      title: "Mastering Hard-Selling & Flash Sale Pitching",
      status: "ACTIVE",
      tenantId: agency.id,
      isCertification: true,
      clientId: client.id,
    },
    create: {
      id: "course-onboarding-01",
      title: "Mastering Hard-Selling & Flash Sale Pitching",
      description: "Panduan komprehensif teknik opening 30 detik pertama, demo produk interaktif, dan cara mendongkrak GMV di Shopee Live & TikTok Shop.",
      status: "ACTIVE",
      tenantId: agency.id,
      isCertification: true,
      clientId: client.id,
    },
  });

  const mod1 = await prisma.module.upsert({
    where: { id: "mod-01" },
    update: { title: "Opening Hook & Formula Flash Sale", courseId: course.id, order: 1, passingScore: 80 },
    create: {
      id: "mod-01",
      courseId: course.id,
      title: "Opening Hook & Formula Flash Sale",
      order: 1,
      passingScore: 80,
    },
  });

  await prisma.lesson.upsert({
    where: { id: "les-01" },
    update: { title: "30 Detik Pertama Siaran Live", moduleId: mod1.id, order: 1 },
    create: {
      id: "les-01",
      moduleId: mod1.id,
      title: "30 Detik Pertama Siaran Live",
      order: 1,
      content: `1. Greeting & Callout: Sapa penonton yang baru join dan sebut nama mereka.\n2. Spill Promo Utama: Umumkan promo terbesar hari ini.\n3. Call to Action (CTA): Arahkan klik keranjang kuning/oranye.`,
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: "q-01" },
    update: { question: "Apa hal terpenting yang harus dilakukan host di 30 detik pertama saat siaran live dimulai?", moduleId: mod1.id },
    create: {
      id: "q-01",
      moduleId: mod1.id,
      type: "MCQ",
      question: "Apa hal terpenting yang harus dilakukan host di 30 detik pertama saat siaran live dimulai?",
      options: ["A. Menunggu 10 menit", "B. Menyapa penonton dan langsung mengumumkan voucher promo utama di keranjang"],
      correctAnswer: "B",
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: "q-02" },
    update: { question: "Berapa menit jeda istirahat minimum antar sesi siaran live (Token Jeda SOP)?", moduleId: mod1.id },
    create: {
      id: "q-02",
      moduleId: mod1.id,
      type: "MCQ",
      question: "Berapa menit jeda istirahat minimum antar sesi siaran live (Token Jeda SOP)?",
      options: ["A. 10 Menit", "B. 30 Menit"],
      correctAnswer: "B",
    },
  });

  // Enroll demo streamer PCS002
  const streamerKaryawan = await prisma.karyawan.findUnique({ where: { idKaryawan: "PCS002" } });
  if (streamerKaryawan) {
    const enrollment = await prisma.enrollment.upsert({
      where: { id: "enroll-pcs002-c01" },
      update: { progressPct: 100, status: "COMPLETED" },
      create: {
        id: "enroll-pcs002-c01",
        courseId: course.id,
        karyawanId: streamerKaryawan.id,
        progressPct: 100,
        status: "COMPLETED",
      },
    });
    // Issue the certification (passing the exam) for the brand client.
    await prisma.certificate.upsert({
      where: { code: "CERT-PCS002-BRAND" },
      update: {},
      create: {
        code: "CERT-PCS002-BRAND",
        enrollmentId: enrollment.id,
        courseId: course.id,
        clientId: client.id,
        streamerKaryawanId: streamerKaryawan.id,
        validTo: new Date("2027-12-31"),
      },
    });
    // Streamer profile (for the client hub).
    const streamerProfile = await prisma.streamerProfile.upsert({
      where: { karyawanId: streamerKaryawan.id },
      update: { photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200" },
      create: {
        tenantId: agency.id,
        karyawanId: streamerKaryawan.id,
        photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
        rating: 4.5,
        totalSessions: 42,
        availability: "FLEXIBLE",
        bio: "Host berpengalaman untuk brand FMCG & fashion di Shopee Live / TikTok Shop. Ahli flash sale & retensi viewer.",
      },
    });
    // Sample experience entries (auto-recorded when projects complete).
    await prisma.streamerExperience.upsert({
      where: { id: "exp-pcs002-01" },
      update: {},
      create: {
        id: "exp-pcs002-01",
        streamerProfileId: streamerProfile.id,
        clientId: client.id,
        title: "Kampanye Flash Sale 8.8",
        platform: "Shopee Live",
        periode: "Agustus 2026",
        result: "Sesi selesai — GMV +120% dari target",
        status: "COMPLETED",
        completedAt: new Date("2026-08-10"),
      },
    });
    await prisma.streamerExperience.upsert({
      where: { id: "exp-pcs002-02" },
      update: {},
      create: {
        id: "exp-pcs002-02",
        streamerProfileId: streamerProfile.id,
        clientId: client.id,
        title: "Peluncuran Produk Skincare",
        platform: "TikTok Shop",
        periode: "Juli 2026",
        result: "Sesi selesai — 45 produk terjual",
        status: "COMPLETED",
        completedAt: new Date("2026-07-15"),
      },
    });
    // Sample marketplace listing for the demo brand.
    // Lives in the CLIENT's tenant so the client can manage/approve it, while
    // agency streamers can still see and apply to it (cross-tenant marketplace).
    await prisma.marketplaceListing.upsert({
      where: { id: "listing-brand-01" },
      update: { tenantId: brand.id, clientId: client.id },
      create: {
        id: "listing-brand-01",
        tenantId: brand.id,
        clientId: client.id,
        courseId: course.id,
        title: "Kampanye Flash Sale 8.8 — Shopee Live",
        description: "Dibutuhkan host bersertifikasi untuk sesi live flash sale 8.8.",
        platform: "Shopee Live",
        ratePerSesi: 150000,
        quota: 2,
        status: "OPEN",
      },
    });
  }

  // --- QC Rubrics ---
  const rubric = await prisma.qCRubric.upsert({
    where: { id: "rubric-std-01" },
    update: { name: "Standar Siaran Live Streaming Agency", tenantId: agency.id },
    create: {
      id: "rubric-std-01",
      name: "Standar Siaran Live Streaming Agency",
      description: "Rubrik audit kualitas siaran live host Potensi Creative",
      tenantId: agency.id,
    },
  });

  await prisma.qCRubricDimension.upsert({
    where: { id: "dim-01" },
    update: { name: "Kualitas Audio & Mikrofon", rubricId: rubric.id, weight: 2, scaleMax: 10 },
    create: { id: "dim-01", rubricId: rubric.id, name: "Kualitas Audio & Mikrofon", weight: 2, scaleMax: 10 },
  });
  await prisma.qCRubricDimension.upsert({
    where: { id: "dim-02" },
    update: { name: "Energi & Antusiasme Host", rubricId: rubric.id, weight: 3, scaleMax: 10 },
    create: { id: "dim-02", rubricId: rubric.id, name: "Energi & Antusiasme Host", weight: 3, scaleMax: 10 },
  });
  await prisma.qCRubricDimension.upsert({
    where: { id: "dim-03" },
    update: { name: "Frekuensi Call to Action (CTA)", rubricId: rubric.id, weight: 3, scaleMax: 10 },
    create: { id: "dim-03", rubricId: rubric.id, name: "Frekuensi Call to Action (CTA)", weight: 3, scaleMax: 10 },
  });

  // --- Live Jadwal Demo ---
  const now = new Date();
  const startLive = new Date(now.getTime() - 30 * 60 * 1000); // 30 mins ago
  const endLive = new Date(now.getTime() + 90 * 60 * 1000); // 90 mins ahead
  await prisma.jadwal.upsert({
    where: { id: "jadwal-demo-live-01" },
    update: { liveState: "LIVE", status: "TERJADWAL", tenantId: agency.id },
    create: {
      id: "jadwal-demo-live-01",
      idJadwal: "JDS/LIVE/001",
      tanggal: now,
      platform: "Shopee Live",
      cabangStudio: "Timoho",
      nomorStudio: "01",
      jamMulaiLive: startLive,
      jamSelesaiLive: endLive,
      status: "TERJADWAL",
      liveState: "LIVE",
      judulLive: "Super Flash Sale 8.8 Live",
      streamerKaryawanId: streamerKaryawan?.id,
      clientId: client.id,
      tenantId: agency.id,
      periodeBulan: "Agustus 2026",
    },
  });

  // --- SOP Task Checklists ---
  const sopTemplate = await prisma.sopTemplate.upsert({
    where: { id: "sop-studio-prep" },
    update: { title: "Persiapan Studio Sebelum Live", tenantId: agency.id },
    create: {
      id: "sop-studio-prep",
      title: "Persiapan Studio Sebelum Live",
      description: "Checklist harian sebelum sesi live streaming dimulai.",
      tenantId: agency.id,
    },
  });
  const sopTasks = [
    { id: "sop-task-01", title: "Nyalakan lighting, mic, dan verifikasi koneksi internet studio.", requiresPhoto: false },
    { id: "sop-task-02", title: "Periksa ketersediaan sample produk klien di studio.", requiresPhoto: false },
    { id: "sop-task-03", title: "Foto setup studio (lighting & layar) sebagai bukti kesiapan.", requiresPhoto: true },
  ];
  for (const [idx, t] of sopTasks.entries()) {
    await prisma.sopTask.upsert({
      where: { id: t.id },
      update: { templateId: sopTemplate.id, order: idx + 1 },
      create: { id: t.id, templateId: sopTemplate.id, title: t.title, order: idx + 1, requiresPhoto: t.requiresPhoto },
    });
  }
  console.log("  SOP checklist templates seeded!");

  console.log("  LMS, QC Rubrics, and Live Schedule seeded successfully!");
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
