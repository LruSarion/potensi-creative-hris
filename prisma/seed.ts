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

  // --- Demo users (one per role) with hashed PINs (PIN: 123456) ---
  const demoUsers = [
    { email: "admin@potensicreative.test", name: "Admin Utama", role: "SUPER_ADMIN", pin: "123456", tenantId: agency.id },
    { email: "ops@potensicreative.test", name: "Ops Lead", role: "OPERATION", pin: "123456", tenantId: agency.id },
    { email: "trainer@potensicreative.test", name: "Trainer Utama", role: "TRAINER", pin: "123456", tenantId: agency.id },
    { email: "qc@potensicreative.test", name: "QC Reviewer", role: "QC_REVIEWER", pin: "123456", tenantId: agency.id },
    { email: "qc-manager@potensicreative.test", name: "QC Manager", role: "QC_MANAGER", pin: "123456", tenantId: agency.id },
    { email: "finance@potensicreative.test", name: "Finance Staff", role: "FINANCE", pin: "123456", tenantId: agency.id },
    { email: "finance-manager@potensicreative.test", name: "Finance Manager", role: "FINANCE_MANAGER", pin: "123456", tenantId: agency.id },
    { email: "client@potensicreative.test", name: "Client Demo", role: "CLIENT", pin: "123456", tenantId: brand.id },
    { email: "client-admin@potensicreative.test", name: "Client Admin", role: "CLIENT_ADMIN", pin: "123456", tenantId: brand.id },
    { email: "streamer@potensicreative.test", name: "Streamer Demo", role: "STREAMER", pin: "123456", tenantId: agency.id },
    { email: "staff@potensicreative.test", name: "Staff Demo", role: "STAFF", pin: "123456", tenantId: agency.id },
    { email: "ots@potensicreative.test", name: "OTS Demo", role: "OTS", pin: "123456", tenantId: agency.id },
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
    where: { id: "course-host-academy" },
    update: {
      title: "Akademi Host Live Stream Potensi (Sertifikasi Profesional)",
      description:
        "Kurikulum komprehensif pelatihan Host Live Streaming profesional mencakup mindset, olah vokal, teknik selling skill, interaksi penonton, kepatuhan platform (TikTok & Shopee), dan evaluasi performa.",
      status: "ACTIVE",
      tenantId: agency.id,
      isCertification: true,
      clientId: client.id,
    },
    create: {
      id: "course-host-academy",
      title: "Akademi Host Live Stream Potensi (Sertifikasi Profesional)",
      description:
        "Kurikulum komprehensif pelatihan Host Live Streaming profesional mencakup mindset, olah vokal, teknik selling skill, interaksi penonton, kepatuhan platform (TikTok & Shopee), dan evaluasi performa.",
      status: "ACTIVE",
      tenantId: agency.id,
      isCertification: true,
      clientId: client.id,
    },
  });

  const babList = [
    {
      id: "mod-bab-01",
      title: "BAB 1 — Mindset & Profil Host (75 menit)",
      order: 1,
      passingScore: 75,
      lessons: [
        {
          id: "les-01-01",
          title: "Apa itu Host Live Stream & Peluang Karir",
          order: 1,
          videoId: "jvdyF7nzlMk",
          videoDuration: 15 * 60,
          content:
            "Tujuan Pembelajaran: Memahami profesi dan prospek karir host live stream.\n\nDalam materi ini, Anda akan mempelajari:\n- Definisi dan peran strategis Host Live Stream dalam industri live commerce modern.\n- Peluang karir dari pemula hingga Top Tier Streamer.\n- Struktur kompensasi, komisi, dan potensi pertumbuhan industri siaran langsung.",
        },
        {
          id: "les-01-02",
          title: "Karakter & Kepribadian Host",
          order: 2,
          videoId: "W9c5oIzEo3k",
          videoDuration: 18 * 60,
          content:
            "Tujuan Pembelajaran: Mengenal sifat-sifat host yang disukai penonton.\n\nDalam materi ini, Anda akan mempelajari:\n- Membangun energi positif dan keramahan di depan kamera.\n- Empati dan kehangatan saat berinteraksi dengan penonton.\n- Menjaga antusiasme dan stamina mental selama berjam-jam siaran.",
        },
        {
          id: "les-01-03",
          title: "Membangun Personal Branding",
          order: 3,
          videoId: "Xm3sRIR8S4Y",
          videoDuration: 20 * 60,
          content:
            "Tujuan Pembelajaran: Mampu merancang identitas unik sebagai host.\n\nDalam materi ini, Anda akan mempelajari:\n- Menentukan ciri khas unik (USP - Unique Selling Proposition).\n- Tagline, jargon sapaan khas, dan signature greeting.\n- Konsistensi gaya visual, busana, dan persona publik.",
        },
      ],
      quizzes: [
        {
          id: "q-01-01",
          question:
            "Apa peran utama seorang Host Live Stream profesional selain mempromosikan produk?",
          options: [
            "A. Menjaga retensi dan membangun hubungan emosional dengan penonton",
            "B. Hanya berbicara tanpa henti",
            "C. Menunggu penonton bertanya",
            "D. Membaca teks deskripsi produk saja",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-01-02",
          question:
            "Mengapa personal branding sangat krusial bagi seorang live streamer?",
          options: [
            "A. Agar terlihat keren di kamera",
            "B. Agar penonton mengenali ciri khas unik dan mudah mengingat host saat siaran berikutnya",
            "C. Supaya bisa menjual barang mahal saja",
            "D. Agar tidak perlu menyapa penonton",
          ],
          correctAnswer: "B",
        },
        {
          id: "q-01-03",
          question:
            "Sifat kepribadian utama apa yang paling menentukan kenyamanan audiens saat menonton siaran live?",
          options: [
            "A. Antusiasme yang tulus, keramahan, dan respon interaktif yang hangat",
            "B. Bicara dengan nada datar",
            "C. Cuek terhadap komentar penonton",
            "D. Menampilkan wajah tanpa ekspresi",
          ],
          correctAnswer: "A",
        },
      ],
    },
    {
      id: "mod-bab-02",
      title: "BAB 2 — Komunikasi & Vokal (75 menit)",
      order: 2,
      passingScore: 75,
      lessons: [
        {
          id: "les-02-01",
          title: "Teknik Berbicara Percaya Diri",
          order: 1,
          videoId: "AKATZ04mAb0",
          videoDuration: 22 * 60,
          content:
            "Tujuan Pembelajaran: Praktek vokal dan kepercayaan diri di kamera.\n\nDalam materi ini, Anda akan mempelajari:\n- Menghilangkan rasa gugup dan demam panggung.\n- Teknik eye-contact dengan lensa kamera secara natural.\n- Olah napas diafragma untuk menopang stamina bicara.",
        },
        {
          id: "les-02-02",
          title: "Olah Vokal: Intonasi & Artikulasi",
          order: 2,
          videoId: "kNVcN0lX0jA",
          videoDuration: 18 * 60,
          content:
            "Tujuan Pembelajaran: Meningkatkan kualitas suara dan kejelasan bicara.\n\nDalam materi ini, Anda akan mempelajari:\n- Artikulasi vokal A-I-U-E-O yang jelas dan tegas.\n- Variasi intonasi (pitch variation) untuk menghindari suara monoton.\n- Penekanan kata kunci promosi (power words).",
        },
        {
          id: "les-02-03",
          title: "Bahasa Tubuh & Ekspresi",
          order: 3,
          videoId: "UWtdwHH2hjg",
          videoDuration: 20 * 60,
          content:
            "Tujuan Pembelajaran: Memahami gestur dan ekspresi yang menarik penonton.\n\nDalam materi ini, Anda akan mempelajari:\n- Penggunaan bahasa tubuh dinamis di area framing kamera.\n- Ekspresi wajah mikro yang menyampaikan ketulusan dan antusiasme.\n- Postur tubuh percaya diri saat berdiri maupun duduk.",
        },
        {
          id: "les-02-04",
          title: "Cara Menyapa Penonton",
          order: 4,
          videoId: "e8d8Wn2SL7Q",
          videoDuration: 15 * 60,
          content:
            "Tujuan Pembelajaran: Membangun kehangatan sejak penonton masuk.\n\nDalam materi ini, Anda akan mempelajari:\n- Formula 3 detik pertama menyapa penonton baru.\n- Teknik menyebut username secara natural dan ramah.\n- Menciptakan kesan selamat datang yang membuat penonton betah.",
        },
      ],
      quizzes: [
        {
          id: "q-02-01",
          question:
            "Kemana arah pandangan mata yang benar saat siaran live agar penonton merasa ditatap secara langsung?",
          options: [
            "A. Menatap lensa kamera",
            "B. Menatap layar kolom komentar terus menerus",
            "C. Menatap cermin di belakang kamera",
            "D. Menatap langit-langit studio",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-02-02",
          question:
            "Mengapa intonasi bicara seorang host harus bervariasi (tidak monoton)?",
          options: [
            "A. Agar penonton tidak bosan dan pesan poin penting produk tersampaikan kuat",
            "B. Agar suara terdengar lebih keras",
            "C. Agar host cepat lelah",
            "D. Tidak ada pengaruhnya",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-02-03",
          question:
            "Formula sapaan apa yang paling efektif saat penonton baru memasuki room siaran?",
          options: [
            "A. Menyebut username penonton dengan ramah dan mengarahkan ke promo terkini",
            "B. Meminta penonton langsung transfer uang",
            "C. Mengabaikan penonton sampai jumlahnya banyak",
            "D. Menegur penonton yang tidak berkomentar",
          ],
          correctAnswer: "A",
        },
      ],
    },
    {
      id: "mod-bab-03",
      title: "BAB 3 — Selling Skill (138 menit)",
      order: 3,
      passingScore: 80,
      lessons: [
        {
          id: "les-03-01",
          title: "Psikologi Pembeli",
          order: 1,
          videoId: "RxH_vSyEx4U",
          videoDuration: 25 * 60,
          content:
            "Tujuan Pembelajaran: Memahami motivasi dan trigger pembelian penonton.\n\nDalam materi ini, Anda akan mempelajari:\n- Faktor emosional vs rasional dalam keputusan belanja impulsif.\n- Mengidentifikasi pain point dan keinginan mendalam audiens.\n- Mengubah penonton pasif (window shopper) menjadi pembeli aktif.",
        },
        {
          id: "les-03-02",
          title: "Product Knowledge",
          order: 2,
          videoId: "DQvU6WmBBe0",
          videoDuration: 22 * 60,
          content:
            "Tujuan Pembelajaran: Menyampaikan informasi produk secara meyakinkan.\n\nDalam materi ini, Anda akan mempelajari:\n- Membedah Features, Advantages, dan Benefits (FAB framework).\n- Menghafal spesifikasi bahan, ukuran, cara pakai, dan varian.\n- Menghubungkan fitur produk dengan solusi nyata masalah pelanggan.",
        },
        {
          id: "les-03-03",
          title: "Presentasi Produk",
          order: 3,
          videoId: "iHu6O8JpViA",
          videoDuration: 28 * 60,
          content:
            "Tujuan Pembelajaran: Teknik demo produk yang menarik dan mengundang beli.\n\nDalam materi ini, Anda akan mempelajari:\n- Teknik demo langsung di depan kamera (texture test, swatch, try on).\n- Menggunakan sensory words untuk membangkitkan imajinasi penonton.\n- Zoom visual dan angle pencahayaan terbaik produk.",
        },
        {
          id: "les-03-04",
          title: "Teknik FOMO",
          order: 4,
          videoId: "vbyoU8WP7EQ",
          videoDuration: 20 * 60,
          content:
            "Tujuan Pembelajaran: Menciptakan urgensi dan kelangkaan yang etis.\n\nDalam materi ini, Anda akan mempelajari:\n- Mengkomunikasikan batasan stok dan batasan waktu flash sale.\n- Countdown voucher diskon khusus siaran live.\n- Menciptakan momentum rebutan keranjang secara positif.",
        },
        {
          id: "les-03-05",
          title: "Handling Objection",
          order: 5,
          videoId: "W9c5oIzEo3k",
          videoDuration: 25 * 60,
          content:
            "Tujuan Pembelajaran: Menjawab keberatan penonton dengan percaya diri.\n\nDalam materi ini, Anda akan mempelajari:\n- Menangani keberatan harga (price objection) dengan value breakdown.\n- Menjawab keraguan keaslian, garansi, dan kecocokan produk.\n- Teknik framing perbandingan cerdas tanpa merendahkan kompetitor.",
        },
        {
          id: "les-03-06",
          title: "Call to Action Efektif",
          order: 6,
          videoId: "RxH_vSyEx4U",
          videoDuration: 18 * 60,
          content:
            "Tujuan Pembelajaran: Mendorong penonton mengklik keranjang pembelian.\n\nDalam materi ini, Anda akan mempelajari:\n- Struktur kalimat Call to Action (CTA) yang tegas dan persuasif.\n- Panduan checkout langkah-demi-langkah bagi penonton baru.\n- Arah klaim voucher ongkir gratis dan metode pembayaran instan.",
        },
      ],
      quizzes: [
        {
          id: "q-03-01",
          question:
            "Apa perbedaan antara Fitur (Feature) dan Manfaat (Benefit) produk saat dipresentasikan?",
          options: [
            "A. Fitur menjelaskan spesifikasi teknis barang, sedangkan Benefit menjelaskan keuntungan nyata yang dirasakan pembeli",
            "B. Keduanya adalah hal yang sama persis",
            "C. Fitur selalu berupa harga produk",
            "D. Benefit hanya untuk produk kecantikan",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-03-02",
          question:
            "Bagaimana cara etis menerapkan teknik FOMO (Fear of Missing Out) di live streaming?",
          options: [
            "A. Menginformasikan stok voucher promo spesial live yang tersisa sedikit secara akurat",
            "B. Membohongi penonton bahwa toko akan tutup",
            "C. Memaksa penonton membeli tanpa penjelasan",
            "D. Menjelekkan produk pesaing",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-03-03",
          question:
            "Ketika penonton berkomentar 'Kak harganya kemahalan', respon terbaik host adalah:",
          options: [
            "A. Mengapresiasi penonton lalu menjelaskan value, kualitas bahan, dan bonus promo yang membuat harga tersebut sangat hemat",
            "B. Meminta penonton pergi ke toko lain",
            "C. Mengabaikan komentar tersebut",
            "D. Menurunkan harga sendiri tanpa izin brand",
          ],
          correctAnswer: "A",
        },
      ],
    },
    {
      id: "mod-bab-04",
      title: "BAB 4 — Engagement & Interaksi (80 menit)",
      order: 4,
      passingScore: 75,
      lessons: [
        {
          id: "les-04-01",
          title: "Membangun Interaksi Aktif",
          order: 1,
          videoId: "vbyoU8WP7EQ",
          videoDuration: 20 * 60,
          content:
            "Tujuan Pembelajaran: Teknik menghidupkan kolom komentar.\n\nDalam materi ini, Anda akan mempelajari:\n- Melontarkan pertanyaan pemantik komentar yang mudah dijawab.\n- Polling preferensi warna/varian produk secara real-time.\n- Menghargai feedback penonton dan membangun atmosfer komunitas.",
        },
        {
          id: "les-04-02",
          title: "Giveaway & Game Viral",
          order: 2,
          videoId: "iHu6O8JpViA",
          videoDuration: 18 * 60,
          content:
            "Tujuan Pembelajaran: Merancang sesi interaktif yang meningkatkan viewer.\n\nDalam materi ini, Anda akan mempelajari:\n- Merancang kuis kilat berhadiah voucher.\n- Game tap-tap layar dan target like challenge.\n- Menjaga transparansi dan kepatuhan aturan giveaway platform.",
        },
        {
          id: "les-04-03",
          title: "Mengelola Komentar Negatif",
          order: 3,
          videoId: "AKATZ04mAb0",
          videoDuration: 22 * 60,
          content:
            "Tujuan Pembelajaran: Menghadapi toxic viewer secara profesional.\n\nDalam materi ini, Anda akan mempelajari:\n- Pengendalian emosi saat menghadapi provokasi atau komentar negatif.\n- Teknik de-eskalasi dan membalikkan suasana menjadi positif.\n- SOP koordinasi dengan tim OTS/Moderator untuk filtering komentar.",
        },
        {
          id: "les-04-04",
          title: "Strategi Retensi Penonton",
          order: 4,
          videoId: "W9c5oIzEo3k",
          videoDuration: 20 * 60,
          content:
            "Tujuan Pembelajaran: Menjaga penonton tetap di live hingga akhir.\n\nDalam materi ini, Anda akan mempelajari:\n- Teaser penawaran misteri di menit-menit krusial siaran.\n- Looping struktur presentasi agar penonton baru tidak tertinggal.\n- Menjaga energi vokal dan variasi aktivitas studio.",
        },
      ],
      quizzes: [
        {
          id: "q-04-01",
          question:
            "Mengapa interaksi di kolom komentar sangat penting bagi algoritma platform live stream?",
          options: [
            "A. Menandakan siaran menarik dan berkualitas tinggi sehingga platform merekomendasikannya ke lebih banyak penonton di FYP/Feeds",
            "B. Hanya untuk mengisi waktu luang",
            "C. Agar host tidak berbicara sendirian",
            "D. Tidak ada hubungannya dengan algoritma",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-04-02",
          question:
            "Sikap terbaik host saat mendapatkan komentar pedas atau provokatif adalah:",
          options: [
            "A. Tetap tenang, tidak terpancing emosi, tanggapi dengan sopan atau serahkan moderasi ke OTS/Admin",
            "B. Membalas menghujat penonton tersebut",
            "C. Menangis di depan kamera",
            "D. Langsung mematikan siaran live",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-04-03",
          question:
            "Teknik 'Teaser Looping' dalam menjaga retensi penonton artinya:",
          options: [
            "A. Membocorkan bahwa promo flash sale terbesar akan dibuka sebentar lagi di menit tertentu",
            "B. Mengulang lagu yang sama terus menerus",
            "C. Mengulang kata sapaan tanpa jeda",
            "D. Memutar video rekaman ulang",
          ],
          correctAnswer: "A",
        },
      ],
    },
    {
      id: "mod-bab-05",
      title: "BAB 5 — Peraturan Platform (78 menit)",
      order: 5,
      passingScore: 80,
      lessons: [
        {
          id: "les-05-01",
          title: "Aturan TikTok Live",
          order: 1,
          videoId: "iHu6O8JpViA",
          videoDuration: 25 * 60,
          content:
            "Tujuan Pembelajaran: Memahami kebijakan dan larangan di TikTok.\n\nDalam materi ini, Anda akan mempelajari:\n- Community Guidelines TikTok Shop & TikTok Live.\n- Larangan kemunculan anak di bawah umur tanpa pengawasan.\n- Kebijakan strike point, banned sementara, dan penalti shadowban.",
        },
        {
          id: "les-05-02",
          title: "Aturan Shopee Live",
          order: 2,
          videoId: "DQvU6WmBBe0",
          videoDuration: 20 * 60,
          content:
            "Tujuan Pembelajaran: Memahami kebijakan dan larangan di Shopee.\n\nDalam materi ini, Anda akan mempelajari:\n- Kebijakan operasional Shopee Live Streaming.\n- Larangan siaran rekaman (looping video) dan unattended streaming.\n- Kesesuaian display produk dengan daftar etalase keranjang oranye.",
        },
        {
          id: "les-05-03",
          title: "Kata-kata Terlarang",
          order: 3,
          videoId: "RxH_vSyEx4U",
          videoDuration: 18 * 60,
          content:
            "Tujuan Pembelajaran: Menghafal kata/frasa yang memicu penalti platform.\n\nDalam materi ini, Anda akan mempelajari:\n- Kata-kata klaim absolut ('terbaik di dunia', '100% sembuh instan').\n- Larangan menyebutkan nomor WhatsApp, transfer bank, atau platform kompetitor.\n- Menghindari kata-kata berkonotasi sensorik/vulgar.",
        },
        {
          id: "les-05-04",
          title: "Etika Siaran",
          order: 4,
          videoId: "jvdyF7nzlMk",
          videoDuration: 15 * 60,
          content:
            "Tujuan Pembelajaran: Standar penampilan dan konten yang sesuai.\n\nDalam materi ini, Anda akan mempelajari:\n- Standar dress code sopan dan profesional sesuai brand guideline.\n- Larangan merokok, vape, atau aktivitas berbahaya saat siaran.\n- Kepatuhan hak cipta musik latar (BGM copyright).",
        },
      ],
      quizzes: [
        {
          id: "q-05-01",
          question:
            "Tindakan mana di bawah ini yang dapat menyebabkan siaran TikTok Shop langsung di-banned atau terkena pelanggaran berat?",
          options: [
            "A. Mengarahkan transaksi penonton ke WhatsApp/transfer bank pribadi di luar keranjang resmi",
            "B. Menjelaskan bahan produk dengan detail",
            "C. Memberikan voucher diskon resmi",
            "D. Menyapa penonton yang baru join",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-05-02",
          question:
            "Mengapa siaran 'Unattended Live' (kamera ditinggal kosong tanpa aktivitas host) dilarang di Shopee Live & TikTok?",
          options: [
            "A. Melanggar standar kualitas konten siaran langsung dan merusak pengalaman pengguna platform",
            "B. Karena kamera menjadi panas",
            "C. Karena studio memakan listrik",
            "D. Boleh dilakukan kapan saja",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-05-03",
          question:
            "Kata atau klaim manakah yang terlarang diucapkan saat mempromosikan produk kecantikan/kesehatan?",
          options: [
            "A. 'Dijamin pasti sembuh 100% dalam 1 hari' (Overclaiming)",
            "B. 'Membantu melembabkan kulit'",
            "C. 'Telah terdaftar resmi di BPOM'",
            "D. 'Gunakan secara teratur untuk hasil maksimal'",
          ],
          correctAnswer: "A",
        },
      ],
    },
    {
      id: "mod-bab-06",
      title: "BAB 6 — Performa & Evaluasi (40 menit)",
      order: 6,
      passingScore: 80,
      lessons: [
        {
          id: "les-06-01",
          title: "Membaca Metrik Live",
          order: 1,
          videoId: "vbyoU8WP7EQ",
          videoDuration: 22 * 60,
          content:
            "Tujuan Pembelajaran: Interpretasi GMV, CVR, viewer count.\n\nDalam materi ini, Anda akan mempelajari:\n- Gross Merchandise Value (GMV) dan Conversion Rate (CVR).\n- Click-Through Rate (CTR) produk keranjang.\n- Menganalisis grafik Average Watch Time dan Peak Concurrent Viewers (PCU).",
        },
        {
          id: "les-06-02",
          title: "Cara Evaluasi Diri",
          order: 2,
          videoId: "Xm3sRIR8S4Y",
          videoDuration: 18 * 60,
          content:
            "Tujuan Pembelajaran: Metode self-review setelah setiap sesi siaran.\n\nDalam materi ini, Anda akan mempelajari:\n- Membedah rekaman siaran (playback analysis) secara berkala.\n- Mengidentifikasi menit-menit penurunan penonton dan penyebabnya.\n- Mencatat keberhasilan promosi produk dan menyusun action plan sesi berikutnya.",
        },
        {
          id: "les-06-03",
          title: "Ujian Akhir Sertifikasi Host Profesional",
          order: 3,
          videoId: null,
          videoDuration: 0,
          content:
            "Tujuan Pembelajaran: Ujian komprehensif — nilai minimum 80 untuk lulus sertifikasi profesi Host Live Streamer Potensi Creative.",
        },
      ],
      quizzes: [
        {
          id: "q-06-01",
          question:
            "Metrik 'Conversion Rate (CVR)' dalam siaran live stream mengukur:",
          options: [
            "A. Persentase penonton yang memutuskan membeli dibanding total penonton yang masuk/klik produk",
            "B. Jumlah follower baru yang follow toko",
            "C. Jumlah durasi siaran dalam jam",
            "D. Kecepatan internet studio",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-06-02",
          question:
            "Jika grafik analitik menunjukkan penonton drop drastis pada menit ke-40, langkah evaluasi yang paling tepat adalah:",
          options: [
            "A. Mengecek rekaman menit ke-40 untuk mengevaluasi apakah energi host turun, topik membosankan, atau ada jeda bicara terlalu lama",
            "B. Menyalahkan koneksi internet",
            "C. Menghentikan jualan produk tersebut",
            "D. Menghapus akun",
          ],
          correctAnswer: "A",
        },
        {
          id: "q-06-03",
          question:
            "Kombinasi 3 pilar utama keberhasilan seorang Host Live Stream profesional adalah:",
          options: [
            "A. Mindset tangguh, Penguasaan Selling & Komunikasi, serta Disiplin mematuhi Regulasi Platform",
            "B. Hanya modal tampang dan suara keras",
            "C. Kamera mahal tanpa persiapan produk",
            "D. Banyak giveaway tanpa menjelaskan jualan",
          ],
          correctAnswer: "A",
        },
      ],
    },
  ];

  for (const bab of babList) {
    const mod = await prisma.module.upsert({
      where: { id: bab.id },
      update: {
        title: bab.title,
        courseId: course.id,
        order: bab.order,
        passingScore: bab.passingScore,
      },
      create: {
        id: bab.id,
        courseId: course.id,
        title: bab.title,
        order: bab.order,
        passingScore: bab.passingScore,
      },
    });

    for (const les of bab.lessons) {
      await prisma.lesson.upsert({
        where: { id: les.id },
        update: {
          title: les.title,
          moduleId: mod.id,
          order: les.order,
          videoId: (les as any).videoId ?? null,
          videoDuration: les.videoDuration,
          content: les.content,
        },
        create: {
          id: les.id,
          moduleId: mod.id,
          title: les.title,
          order: les.order,
          videoId: (les as any).videoId ?? null,
          videoDuration: les.videoDuration,
          content: les.content,
        },
      });
    }

    for (const q of bab.quizzes) {
      await prisma.quizQuestion.upsert({
        where: { id: q.id },
        update: {
          question: q.question,
          moduleId: mod.id,
          type: "MCQ",
          options: q.options,
          correctAnswer: q.correctAnswer,
        },
        create: {
          id: q.id,
          moduleId: mod.id,
          type: "MCQ",
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
        },
      });
    }
  }

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

  // --- Master Libur Periode 2026 (12 periode bulanan) ---
  // Blackout: double-date (tgl = nomor bulan) + payday (tgl 25) setiap bulan.
  const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    const dd = String(m).padStart(2, "0");
    const periode = `${bulanIndo[m - 1]} 2026`;
    await prisma.masterLiburPeriode.upsert({
      where: { tenantId_periode: { tenantId: agency.id, periode } },
      update: {},
      create: {
        tenantId: agency.id,
        periode,
        kebutuhanJam: 192, // 24 hari x 8 jam
        kuotaHarian: 4,
        floorKuota: 1,
        blackoutDates: [`2026-${mm}-${dd}`, `2026-${mm}-25`],
        catatan: "Seed otomatis: blackout double-date & payday.",
      },
    });
  }
  console.log("  master libur periode 2026: 12 periode");

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
