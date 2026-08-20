import { z } from "zod";

// Pure Zod schema for employee create/update. Kept separate from the service
// so it can be unit-tested without pulling in auth/db dependencies.
export const karyawanSchema = z.object({
  idKaryawan: z.string().min(1),
  namaLengkap: z.string().min(1),
  namaPanggilan: z.string().optional().nullable(),
  gender: z.enum(["LAKI_LAKI", "PEREMPUAN"]).optional().nullable(),
  jabatan: z.string().optional().nullable(),
  kategori: z.string().optional().nullable(),
  tipeJadwal: z.enum(["OFFICE_HOURS", "SHIFT", "LIVE"]).optional().nullable(),
  nomorTelepon: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  statusAktif: z.enum(["AKTIF", "NON_AKTIF"]).optional().nullable(),
  nik: z.string().optional().nullable(),
  npwp: z.string().optional().nullable(),
  statusPtkp: z.string().optional().nullable(),
  alamatKtp: z.string().optional().nullable(),
  alamatDomisili: z.string().optional().nullable(),
  tempatLahir: z.string().optional().nullable(),
  tanggalLahir: z.string().optional().nullable(),
  statusPerkawinan: z.string().optional().nullable(),
  agama: z.string().optional().nullable(),
  riwayatPenyakit: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  scanKtpDriveId: z.string().optional().nullable(),
  scanKkDriveId: z.string().optional().nullable(),
  scanNpwpDriveId: z.string().optional().nullable(),
  namaBank: z.string().optional().nullable(),
  nomorRekening: z.string().optional().nullable(),
  namaPemilikRek: z.string().optional().nullable(),
  linkFolder: z.string().optional().nullable(),
});

export type KaryawanInput = z.infer<typeof karyawanSchema>;
