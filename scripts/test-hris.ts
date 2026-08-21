import { config } from "dotenv";
config();
import { db } from "../src/lib/db";

async function main() {
  console.log("Menyiapkan data testing HRIS Potensi Creative...");

  // 1. Setup Karyawan untuk testing (PCS001)
  let karyawan = await db.karyawan.findUnique({ where: { idKaryawan: "PCS001" } });
  if (!karyawan) {
    karyawan = await db.karyawan.create({
      data: {
        idKaryawan: "PCS001",
        namaLengkap: "Streamer Test",
        kategori: "FULL_TIME",
        tipeJadwal: "LIVE",
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Kontrak sisa 15 hari
      },
    });
  }

  // 2. Link ke akun Super Admin agar bisa ditest di browser
  const admin = await db.user.findFirst({ where: { email: "admin@potensi.com" } });
  if (admin && karyawan.userId !== admin.id) {
    await db.karyawan.update({
      where: { id: karyawan.id },
      data: { userId: admin.id }
    });
  }

  // 3. Buat Client / Tenant
  let client = await db.client.findFirst();
  if (!client) {
    client = await db.client.create({ data: { namaClient: "Vegeta Shopee" } });
  }

  // 4. Bersihkan absensi sebelumnya untuk PCS001 agar fresh
  await db.absensi.deleteMany({ where: { karyawanId: karyawan.id } });
  await db.jadwal.deleteMany({ where: { streamerKaryawanId: karyawan.id } });

  const now = new Date();
  
  // Sesi 1: Sedang berjalan (harus di check-out)
  const jadwal1 = await db.jadwal.create({
    data: {
      idJadwal: "JDS/TEST/001",
      tanggal: now,
      jamMulaiLive: new Date(now.getTime() - 60 * 60000), // 1 jam lalu
      jamSelesaiLive: now,
      streamerKaryawanId: karyawan.id,
      clientId: client.id,
      liveState: "LIVE", // Sedang LIVE, perlu check-out
    }
  });

  // Check-In untuk Sesi 1 (agar aktif)
  await db.absensi.create({
    data: {
      karyawanId: karyawan.id,
      jadwalId: jadwal1.id,
      tipe: "CHECK_IN",
      kategori: "STREAMER"
    }
  });

  // Sesi 2: Jarak kurang dari 30 menit (Untuk test Absensi Terusan)
  await db.jadwal.create({
    data: {
      idJadwal: "JDS/TEST/002",
      tanggal: now,
      jamMulaiLive: new Date(now.getTime() + 15 * 60000), // 15 menit dari sekarang
      jamSelesaiLive: new Date(now.getTime() + 75 * 60000),
      streamerKaryawanId: karyawan.id,
      clientId: client.id,
      liveState: "SCHEDULED"
    }
  });

  // Sesi 3: Jarak 40 menit (Untuk test gagal check-in karena > 30 menit)
  await db.jadwal.create({
    data: {
      idJadwal: "JDS/TEST/003",
      tanggal: now,
      jamMulaiLive: new Date(now.getTime() + 40 * 60000), // 40 menit dari sekarang
      jamSelesaiLive: new Date(now.getTime() + 100 * 60000),
      streamerKaryawanId: karyawan.id,
      clientId: client.id,
      liveState: "SCHEDULED"
    }
  });

  // 5. Tambahkan Insiden (Pelanggaran) yang di approve (RESOLVED) untuk ngetes Denda di Dashboard
  let cat = await db.violationCategory.findFirst();
  if (!cat) {
    cat = await db.violationCategory.create({
      data: { name: "Telat Live", description: "Telat mulai sesi", defaultFine: 50000 }
    });
  }
  await db.incident.create({
    data: {
      title: "Telat Live Sesi Pagi",
      severity: "MEDIUM",
      status: "RESOLVED",
      categoryId: cat.id,
      fineApplied: 50000,
      streamerKaryawanId: karyawan.id,
    }
  });

  console.log("✅ Data testing berhasil disiapkan!");
  console.log("Silakan buka: http://localhost:3000/streamer-dashboard");
}

main().catch(console.error);
