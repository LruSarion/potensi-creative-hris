import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requirePermission, requireRole, tenantWhere } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { karyawanSchema, type KaryawanInput } from "@/lib/schemas/karyawan";
import type { Gender, TipeJadwal, StatusAktif } from "@/generated/prisma/enums";

function toDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeGender(g?: string | null): Gender | undefined {
  if (!g) return undefined;
  const upper = g.toUpperCase();
  if (upper.includes("LAKI")) return "LAKI_LAKI";
  if (upper.includes("PEREMPUAN")) return "PEREMPUAN";
  return undefined;
}

function normalizeTipeJadwal(t?: string | null): TipeJadwal | undefined {
  if (!t) return undefined;
  const upper = t.toUpperCase();
  if (upper.includes("OFFICE")) return "OFFICE_HOURS";
  if (upper.includes("SHIFT")) return "SHIFT";
  if (upper.includes("FLEXIBLE") || upper.includes("LIVE")) return "LIVE";
  return undefined;
}

function normalizeStatusAktif(s?: string | null): StatusAktif | undefined {
  if (!s) return undefined;
  const upper = s.toUpperCase();
  if (upper.includes("NON")) return "NON_AKTIF";
  return "AKTIF";
}

export async function listEmployees(params?: { kategori?: string }) {
  const user = await requireRole();
  const isAdmin = hasPermission(user.role, "employee:write");

  const whereClause: any = tenantWhere(user);
  if (params?.kategori) {
    whereClause.kategori = {
      contains: params.kategori,
      mode: "insensitive",
    };
  }

  const rows = await db.karyawan.findMany({
    where: whereClause,
    orderBy: { namaLengkap: "asc" },
  });

  if (isAdmin) return rows;

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
  const row = await db.karyawan.findFirst({
    where: {
      OR: [{ id }, { idKaryawan: id }],
      ...tenantWhere(user),
    },
  });
  if (!row) throw AppError.notFound("Karyawan tidak ditemukan");
  if (isAdmin) return row;
  if (user.karyawanId === row.id) return row;
  throw AppError.forbidden("Akses ditolak");
}

export async function createEmployee(input: any) {
  const user = await requirePermission("employee:write");
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");

  const autoId = input.idKaryawan || `PC${Math.floor(1000 + Math.random() * 9000)}`;

  const existing = await db.karyawan.findFirst({
    where: { idKaryawan: autoId, ...tenantWhere(user) },
  });
  if (existing) throw AppError.conflict(`ID Karyawan ${autoId} sudah terdaftar`);

  return db.karyawan.create({
    data: {
      tenantId: user.tenantId,
      idKaryawan: autoId,
      namaLengkap: input.namaLengkap,
      namaPanggilan: input.namaPanggilan ?? null,
      gender: normalizeGender(input.gender),
      tempatLahir: input.tempatLahir ?? null,
      tanggalLahir: toDate(input.tanggalLahir),
      agama: input.agama ?? null,
      nomorTelepon: input.nomorTelepon ?? null,
      emergencyContact: input.emergencyContact ?? null,
      email: input.email ?? null,
      statusPerkawinan: input.statusPerkawinan ?? null,
      riwayatPenyakit: input.riwayatPenyakit ?? null,
      jabatan: input.jabatan ?? "Staff",
      kategori: input.kategori ?? "Staff",
      tipeJadwal: normalizeTipeJadwal(input.tipeJadwal),
      startDate: toDate(input.startDate) ?? new Date(),
      endDate: toDate(input.endDate),
      statusAktif: normalizeStatusAktif(input.statusAktif),
      nik: input.nik ?? null,
      npwp: input.npwp ?? null,
      statusPtkp: input.statusPtkp ?? null,
      alamatKtp: input.alamatKtp ?? null,
      alamatDomisili: input.alamatDomisili ?? null,
      namaBank: input.namaBank ?? null,
      nomorRekening: input.nomorRekening ?? null,
      namaPemilikRek: input.namaPemilikRek ?? input.namaPemilikRekening ?? null,
      scanKtpDriveId: input.scanKtpDriveId ?? input.scanKtp ?? null,
      scanKkDriveId: input.scanKkDriveId ?? input.scanKk ?? null,
      scanNpwpDriveId: input.scanNpwpDriveId ?? input.scanNpwp ?? null,
      streamerCutPct: Number(input.streamerCutPct ?? 70),
      agencyCutPct: Number(input.agencyCutPct ?? 30),
    },
  });
}

export async function createBulkEmployees(items: any[]) {
  await requirePermission("employee:write");
  const created = [];
  for (const item of items) {
    const res = await createEmployee(item);
    created.push(res);
  }
  return created;
}

export async function updateEmployee(id: string, input: any) {
  const user = await requirePermission("employee:write");
  const existing = await db.karyawan.findFirst({
    where: {
      OR: [{ id }, { idKaryawan: id }],
      ...tenantWhere(user),
    },
  });
  if (!existing) throw AppError.notFound("Karyawan tidak ditemukan");

  const dataToUpdate: any = {};
  if (input.namaLengkap !== undefined) dataToUpdate.namaLengkap = input.namaLengkap;
  if (input.namaPanggilan !== undefined) dataToUpdate.namaPanggilan = input.namaPanggilan;
  if (input.gender !== undefined) dataToUpdate.gender = normalizeGender(input.gender);
  if (input.tempatLahir !== undefined) dataToUpdate.tempatLahir = input.tempatLahir;
  if (input.tanggalLahir !== undefined) dataToUpdate.tanggalLahir = toDate(input.tanggalLahir);
  if (input.agama !== undefined) dataToUpdate.agama = input.agama;
  if (input.nomorTelepon !== undefined) dataToUpdate.nomorTelepon = input.nomorTelepon;
  if (input.emergencyContact !== undefined) dataToUpdate.emergencyContact = input.emergencyContact;
  if (input.email !== undefined) dataToUpdate.email = input.email;
  if (input.statusPerkawinan !== undefined) dataToUpdate.statusPerkawinan = input.statusPerkawinan;
  if (input.riwayatPenyakit !== undefined) dataToUpdate.riwayatPenyakit = input.riwayatPenyakit;
  if (input.jabatan !== undefined) dataToUpdate.jabatan = input.jabatan;
  if (input.kategori !== undefined) dataToUpdate.kategori = input.kategori;
  if (input.tipeJadwal !== undefined) dataToUpdate.tipeJadwal = normalizeTipeJadwal(input.tipeJadwal);
  if (input.startDate !== undefined) dataToUpdate.startDate = toDate(input.startDate);
  if (input.endDate !== undefined) dataToUpdate.endDate = toDate(input.endDate);
  if (input.statusAktif !== undefined) dataToUpdate.statusAktif = normalizeStatusAktif(input.statusAktif);
  if (input.nik !== undefined) dataToUpdate.nik = input.nik;
  if (input.npwp !== undefined) dataToUpdate.npwp = input.npwp;
  if (input.statusPtkp !== undefined) dataToUpdate.statusPtkp = input.statusPtkp;
  if (input.alamatKtp !== undefined) dataToUpdate.alamatKtp = input.alamatKtp;
  if (input.alamatDomisili !== undefined) dataToUpdate.alamatDomisili = input.alamatDomisili;
  if (input.namaBank !== undefined) dataToUpdate.namaBank = input.namaBank;
  if (input.nomorRekening !== undefined) dataToUpdate.nomorRekening = input.nomorRekening;
  if (input.namaPemilikRek !== undefined || input.namaPemilikRekening !== undefined) {
    dataToUpdate.namaPemilikRek = input.namaPemilikRek ?? input.namaPemilikRekening;
  }
  if (input.scanKtpDriveId !== undefined || input.scanKtp !== undefined) {
    dataToUpdate.scanKtpDriveId = input.scanKtpDriveId ?? input.scanKtp;
  }
  if (input.scanKkDriveId !== undefined || input.scanKk !== undefined) {
    dataToUpdate.scanKkDriveId = input.scanKkDriveId ?? input.scanKk;
  }
  if (input.scanNpwpDriveId !== undefined || input.scanNpwp !== undefined) {
    dataToUpdate.scanNpwpDriveId = input.scanNpwpDriveId ?? input.scanNpwp;
  }

  return db.karyawan.update({
    where: { id: existing.id },
    data: dataToUpdate,
  });
}

export async function deactivateEmployee(id: string) {
  const user = await requirePermission("employee:write");
  const existing = await db.karyawan.findFirst({
    where: {
      OR: [{ id }, { idKaryawan: id }],
      ...tenantWhere(user),
    },
  });
  if (!existing) throw AppError.notFound("Karyawan tidak ditemukan");
  return db.karyawan.update({
    where: { id: existing.id },
    data: { statusAktif: "NON_AKTIF" },
  });
}
