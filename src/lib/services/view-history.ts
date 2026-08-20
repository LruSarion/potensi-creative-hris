import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

/**
 * Full DB view — admin only. Returns all core tables.
 */
export async function getViewData() {
  await requireRole(...ADMIN_ROLES);
  const [karyawan, clients, jadwal, absensi, lembur, izin, payroll, tiering] =
    await Promise.all([
      db.karyawan.findMany(),
      db.client.findMany({ include: { ketentuan: true, produk: true } }),
      db.jadwal.findMany({ include: { client: true } }),
      db.absensi.findMany(),
      db.lembur.findMany(),
      db.izin.findMany(),
      db.payroll.findMany(),
      db.tiering.findMany(),
    ]);
  return { karyawan, clients, jadwal, absensi, lembur, izin, payroll, tiering };
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
