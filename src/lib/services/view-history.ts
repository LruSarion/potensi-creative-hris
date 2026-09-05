import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

/**
 * On-demand DB view — admin only. Returns specified table or lightweight initial set with counts.
 */
export async function getViewData(tab?: string) {
  await requireRole(...ADMIN_ROLES);
  if (tab === "karyawan") return { karyawan: await db.karyawan.findMany({ take: 200 }) };
  if (tab === "clients") return { clients: await db.client.findMany({ include: { ketentuan: true, produk: true }, take: 200 }) };
  if (tab === "jadwal") return { jadwal: await db.jadwal.findMany({ include: { client: true }, take: 200, orderBy: { tanggal: "desc" } }) };
  if (tab === "absensi") return { absensi: await db.absensi.findMany({ take: 200, orderBy: { waktu: "desc" } }) };
  if (tab === "lembur") return { lembur: await db.lembur.findMany({ take: 200, orderBy: { createdAt: "desc" } }) };
  if (tab === "izin") return { izin: await db.izin.findMany({ take: 200, orderBy: { createdAt: "desc" } }) };
  if (tab === "payroll") return { payroll: await db.payroll.findMany({ take: 200, orderBy: { createdAt: "desc" } }) };
  if (tab === "tiering") return { tiering: await db.tiering.findMany() };

  const [counts, initialKaryawan] = await Promise.all([
    Promise.all([
      db.karyawan.count(),
      db.client.count(),
      db.jadwal.count(),
      db.absensi.count(),
      db.lembur.count(),
      db.izin.count(),
      db.payroll.count(),
      db.tiering.count(),
    ]),
    db.karyawan.findMany({ take: 200 }),
  ]);

  return {
    counts: {
      karyawan: counts[0],
      clients: counts[1],
      jadwal: counts[2],
      absensi: counts[3],
      lembur: counts[4],
      izin: counts[5],
      payroll: counts[6],
      tiering: counts[7],
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
