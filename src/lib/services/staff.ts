import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";

/**
 * Staff/OTS dashboard: helper data + own absensi session + stats.
 */

/** Require STAFF/OTS (or admin) and return karyawan id. */
async function requireStaff(): Promise<string> {
  const user = await requireRole("STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL");
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  return user.karyawanId;
}

/** Helper data for staff/OTS (reference lists). */
export async function getHelperStaff() {
  await requireStaff();
  const [karyawan, clients] = await Promise.all([
    db.karyawan.findMany({
      where: { statusAktif: "AKTIF" },
      select: { id: true, idKaryawan: true, namaLengkap: true, jabatan: true, kategori: true },
      orderBy: { namaLengkap: "asc" },
    }),
    db.client.findMany({ select: { id: true, namaClient: true, platform: true } }),
  ]);
  return { karyawan, clients };
}

/** Current active session for the staff member (or null). */
export async function getMySesiAktif() {
  const karyawanId = await requireStaff();
  const lastCheckIn = await db.absensi.findFirst({
    where: { karyawanId, tipe: "CHECK_IN" },
    orderBy: { waktu: "desc" },
  });
  if (!lastCheckIn) return null;
  const lastCheckOut = await db.absensi.findFirst({
    where: { karyawanId, tipe: "CHECK_OUT" },
    orderBy: { waktu: "desc" },
  });
  if (lastCheckOut && lastCheckOut.waktu > lastCheckIn.waktu) return null;
  return lastCheckIn;
}

/** Monthly attendance stats for staff member. */
export async function getStaffStats() {
  const karyawanId = await requireStaff();

  const checkIns = await db.absensi.findMany({
    where: { karyawanId, tipe: "CHECK_IN" },
    orderBy: { waktu: "desc" },
    take: 100,
  });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const thisMonthCheckIns = checkIns.filter((c) => new Date(c.waktu) >= startOfMonth);

  const activeDaysSet = new Set(
    thisMonthCheckIns.map((c) => new Date(c.waktu).toISOString().split("T")[0])
  );
  const hariAktif = activeDaysSet.size;
  const jamKerja = Math.round(hariAktif * 8 * 10) / 10;

  return {
    jamKerja,
    hariAktif,
    sisaCuti: 12,
  };
}
