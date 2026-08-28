import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";

/**
 * Staff/OTS dashboard: helper data + own absensi session + stats + Admin supervision mode.
 */

/** Require STAFF/OTS (or admin) and resolve target karyawan id if admin search is provided. */
async function resolveStaffTarget(targetSearchOrId?: string): Promise<{ karyawanId: string; karyawan: any }> {
  const user = await requireRole("STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION");
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role);

  if (targetSearchOrId && targetSearchOrId.trim() && isAdmin) {
    const term = targetSearchOrId.trim();
    const found = await db.karyawan.findFirst({
      where: {
        OR: [
          { id: term },
          { idKaryawan: { equals: term, mode: "insensitive" } },
          { namaLengkap: { contains: term, mode: "insensitive" } },
          { namaPanggilan: { contains: term, mode: "insensitive" } },
        ],
      },
    });
    if (found) return { karyawanId: found.id, karyawan: found };
  }

  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  const selfKaryawan = await db.karyawan.findUnique({ where: { id: user.karyawanId } });
  return { karyawanId: user.karyawanId, karyawan: selfKaryawan };
}

/** Helper data for staff/OTS (reference lists). */
export async function getHelperStaff() {
  const user = await requireRole("STAFF", "OTS", "SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION");
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
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

/** Current active session for the staff member (or monitored staff if admin). */
export async function getMySesiAktif(target?: string) {
  const { karyawanId } = await resolveStaffTarget(target);
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

/** Monthly attendance stats for staff member (or monitored staff if admin). */
export async function getStaffStats(target?: string) {
  const { karyawanId, karyawan } = await resolveStaffTarget(target);

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
    karyawan: karyawan
      ? {
          id: karyawan.id,
          idKaryawan: karyawan.idKaryawan,
          namaLengkap: karyawan.namaLengkap,
          namaPanggilan: karyawan.namaPanggilan,
          jabatan: karyawan.jabatan,
          kategori: karyawan.kategori,
        }
      : null,
    jamKerja,
    hariAktif,
    sisaCuti: 12,
  };
}
