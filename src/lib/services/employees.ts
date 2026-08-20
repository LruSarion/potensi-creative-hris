import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requirePermission, requireRole, tenantWhere, assertTenantScope } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { karyawanSchema, type KaryawanInput } from "@/lib/schemas/karyawan";

function toDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function listEmployees() {
  // Read gating: admins see full; others see limited fields.
  const user = await requireRole();
  const isAdmin = hasPermission(user.role, "employee:write");

  const rows = await db.karyawan.findMany({
    where: tenantWhere(user),
    orderBy: { namaLengkap: "asc" },
  });

  if (isAdmin) return rows;

  // Non-admin: strip sensitive fields (NIK, NPWP, bank, addresses).
  return rows.map((r) => ({
    id: r.id,
    idKaryawan: r.idKaryawan,
    namaLengkap: r.namaLengkap,
    namaPanggilan: r.namaPanggilan,
    jabatan: r.jabatan,
    kategori: r.kategori,
    tipeJadwal: r.tipeJadwal,
    nomorTelepon: r.nomorTelepon,
    email: r.email,
    statusAktif: r.statusAktif,
  }));
}

export async function getEmployee(id: string) {
  const user = await requireRole();
  const isAdmin = hasPermission(user.role, "employee:write");
  const row = await db.karyawan.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!row) throw AppError.notFound("Karyawan tidak ditemukan");
  if (isAdmin) return row;
  // Non-admin can only view their own record fully.
  if (user.karyawanId === row.id) return row;
  throw AppError.forbidden("Akses ditolak");
}

export async function createEmployee(input: KaryawanInput) {
  const user = await requirePermission("employee:write");
  const parsed = karyawanSchema.parse(input);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  const existing = await db.karyawan.findFirst({
    where: { idKaryawan: parsed.idKaryawan, ...tenantWhere(user) },
  });
  if (existing) throw AppError.conflict("ID Karyawan sudah terdaftar");
  return db.karyawan.create({
    data: {
      ...parsed,
      tenantId: user.tenantId,
      gender: parsed.gender ?? undefined,
      tipeJadwal: parsed.tipeJadwal ?? undefined,
      statusAktif: parsed.statusAktif ?? undefined,
      startDate: toDate(parsed.startDate),
      endDate: toDate(parsed.endDate),
      tanggalLahir: toDate(parsed.tanggalLahir),
    },
  });
}

export async function updateEmployee(id: string, input: KaryawanInput) {
  const user = await requirePermission("employee:write");
  const parsed = karyawanSchema.parse(input);
  const existing = await db.karyawan.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!existing) throw AppError.notFound("Karyawan tidak ditemukan");
  return db.karyawan.update({
    where: { id },
    data: {
      ...parsed,
      gender: parsed.gender ?? undefined,
      tipeJadwal: parsed.tipeJadwal ?? undefined,
      statusAktif: parsed.statusAktif ?? undefined,
      startDate: toDate(parsed.startDate),
      endDate: toDate(parsed.endDate),
      tanggalLahir: toDate(parsed.tanggalLahir),
    },
  });
}

export async function deactivateEmployee(id: string) {
  const user = await requirePermission("employee:write");
  const existing = await db.karyawan.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!existing) throw AppError.notFound("Karyawan tidak ditemukan");
  return db.karyawan.update({
    where: { id },
    data: { statusAktif: "NON_AKTIF" },
  });
}
