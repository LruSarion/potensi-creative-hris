import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

/**
 * On-demand DB view — admin only. Returns specified table or lightweight initial set with counts.
 */
export async function getViewData(tab?: string) {
  await requireRole(...ADMIN_ROLES);

  // Tab: karyawan — DB Karyawan
  if (tab === "karyawan") {
    const data = await db.karyawan.findMany({
      take: 200,
      orderBy: { idKaryawan: "asc" },
      select: {
        idKaryawan: true,
        namaLengkap: true,
        jabatan: true,
        kategori: true,
        statusAktif: true,
        nomorTelepon: true,
      },
    });
    return { karyawan: data };
  }

  // Tab: jadwal-streamer — Jadwal Streamers (Host/Streamer)
  if (tab === "jadwal-streamer") {
    const data = await db.jadwal.findMany({
      take: 200,
      orderBy: { tanggal: "desc" },
      where: {
        OR: [
          { hostKaryawanId: { not: null } },
          { streamerKaryawanId: { not: null } },
        ],
      },
      include: {
        hostKaryawan: { select: { idKaryawan: true, namaLengkap: true } },
        streamerKaryawan: { select: { idKaryawan: true, namaLengkap: true } },
        client: { select: { namaClient: true } },
      },
    });
    return { jadwalStreamer: data };
  }

  // Tab: jadwal-ots — Jadwal OTS
  if (tab === "jadwal-ots") {
    const data = await db.jadwal.findMany({
      take: 200,
      orderBy: { tanggal: "desc" },
      where: {
        otsKaryawanId: { not: null },
      },
      include: {
        otsKaryawan: { select: { idKaryawan: true, namaLengkap: true } },
        client: { select: { namaClient: true } },
      },
    });
    return { jadwalOts: data };
  }

  // Tab: absensi — Log Absensi (pair check-in/out per hari per karyawan)
  if (tab === "absensi") {
    const raw = await db.absensi.findMany({
      take: 500,
      orderBy: { waktu: "desc" },
      include: {
        karyawan: { select: { idKaryawan: true, namaLengkap: true } },
      },
    });

    // Group by tanggal (WIB) + karyawan, pair check-in/out
    const grouped = new Map<string, any>();
    for (const a of raw) {
      const dateKey = a.waktu.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
      const key = `${dateKey}|${a.karyawanId}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          TANGGAL: dateKey,
          ID_KARYAWAN: a.karyawan.idKaryawan,
          NAMA_LENGKAP: a.karyawan.namaLengkap,
          WAKTU_ABSEN_MASUK: null,
          WAKTU_ABSEN_KELUAR: null,
          STATUS_KEHADIRAN: "-",
        });
      }
      const entry = grouped.get(key);
      const timeStr = a.waktu.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
      if (a.tipe === "CHECK_IN") {
        entry.WAKTU_ABSEN_MASUK = timeStr;
      } else if (a.tipe === "CHECK_OUT") {
        entry.WAKTU_ABSEN_KELUAR = timeStr;
      }
    }

    // Compute status kehadiran
    const result = Array.from(grouped.values()).map((e) => {
      const masuk = e.WAKTU_ABSEN_MASUK;
      const keluar = e.WAKTU_ABSEN_KELUAR;
      let status = "-";
      if (masuk && keluar) status = "HADIR";
      else if (masuk && !keluar) status = "BELUM KELUAR";
      else if (!masuk && keluar) status = "TANPA MASUK";
      e.STATUS_KEHADIRAN = status;
      return e;
    });

    return { absensi: result };
  }

  // Initial load — counts for all 4 tabs + karyawan data
  const [counts, initialKaryawan] = await Promise.all([
    Promise.all([
      db.karyawan.count(),
      db.jadwal.count({ where: { OR: [{ hostKaryawanId: { not: null } }, { streamerKaryawanId: { not: null } }] } }),
      db.jadwal.count({ where: { otsKaryawanId: { not: null } } }),
      db.absensi.count(),
    ]),
    db.karyawan.findMany({
      take: 200,
      orderBy: { idKaryawan: "asc" },
      select: {
        idKaryawan: true,
        namaLengkap: true,
        jabatan: true,
        kategori: true,
        statusAktif: true,
        nomorTelepon: true,
      },
    }),
  ]);

  return {
    counts: {
      karyawan: counts[0],
      jadwalStreamer: counts[1],
      jadwalOts: counts[2],
      absensi: counts[3],
    },
    karyawan: initialKaryawan,
  };
}

/**
 * History log — admin sees all; others see only their own entries.
 */
export async function getHistory(params?: { userId?: string }) {
  const user = await requireRole();
  const isAdmin = ADMIN_ROLES.includes(user.role);
  // Non-admins may only view their own history (param ignored for isolation).
  const userId = isAdmin ? params?.userId ?? user.id : user.id;
  return db.logAktivitas.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { email: true, name: true } } },
  });
}
