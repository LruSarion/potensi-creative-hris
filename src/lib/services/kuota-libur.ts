import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";

export type KuotaCode =
  | "OK"
  | "BLACKOUT"
  | "ALREADY_BOOKED"
  | "QUOTA_FULL"
  | "K3_VIOLATION"
  | "WEEKLY_LIMIT";

export interface ShiftQuota {
  sesi: "SESI_1" | "SESI_2" | "SESI_3";
  label: string;
  kuota: number;
  terpakai: number;
  sisa: number;
}

export interface KuotaLiburResult {
  tanggal: string; // yyyy-mm-dd
  periode: string; // "September 2026"
  kuota: number;
  terpakai: number;
  sisa: number;
  blackout: boolean;
  blackoutKind: "DOUBLE_DATE" | "PAYDAY" | "BLACKOUT" | null;
  kebutuhanJam: number;
  availableShifts: ShiftQuota[];
}

export interface EligibilityResult extends KuotaLiburResult {
  code: KuotaCode;
  message: string;
}

const BULAN_INDO = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function periodeLabel(d: Date): string {
  return `${BULAN_INDO[d.getMonth()]} ${d.getFullYear()}`;
}

export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYMD(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) throw AppError.badRequest("Format tanggal tidak valid (gunakan yyyy-mm-dd).", "VALIDATION_ERROR");
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  if (isNaN(d.getTime())) throw AppError.badRequest("Tanggal tidak valid.", "VALIDATION_ERROR");
  return d;
}

/** Senin–Minggu (ala ref-deploy cekLiburMingguan). */
export function weekRange(d: Date): { start: Date; end: Date } {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.getFullYear(), d.getMonth(), diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function tenantConfig(tenantId?: string | null): Promise<Record<string, any>> {
  if (!tenantId) return {};
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  return (tenant?.config ?? {}) as Record<string, any>;
}

/**
 * Hitung kuota libur harian.
 * Formula: override > blackout(0) > max(floorKuota, round(kuotaHarian * bobotKPI * faktorKebutuhan))
 * - bobotKPI: rata-rata skor PenilaianSDM periode ini -> faktor 0.8..1.2 (tanpa data = 1)
 * - faktorKebutuhan: pasokan jam streamer aktif vs kebutuhanJam periode (0.5..1.5)
 */
export async function getKuotaLibur(tanggalYMD: string, tenantId?: string | null): Promise<KuotaLiburResult> {
  const d = parseYMD(tanggalYMD);
  const ymd = toYMD(d);
  const periode = periodeLabel(d);
  const cfg = await tenantConfig(tenantId);

  const row = await db.masterLiburPeriode.findFirst({
    where: { periode, OR: [{ tenantId: tenantId ?? undefined }, { tenantId: null }] },
    orderBy: { tenantId: "desc" },
  });

  const blackoutDates = (row?.blackoutDates ?? []) as string[];
  const blackout = blackoutDates.includes(ymd);
  let blackoutKind: KuotaLiburResult["blackoutKind"] = null;
  if (blackout) {
    const dayNum = d.getDate();
    if (dayNum === d.getMonth() + 1) blackoutKind = "DOUBLE_DATE";
    else if (dayNum === 25) blackoutKind = "PAYDAY";
    else blackoutKind = "BLACKOUT";
  }

  const overrides = (row?.kuotaOverrides ?? {}) as Record<string, number>;
  const overrideVal = typeof overrides[ymd] === "number" ? overrides[ymd] : null;

  const kuotaHarian = row?.kuotaHarian ?? (typeof cfg.defaultKuotaLibur === "number" ? cfg.defaultKuotaLibur : 4);
  const floorKuota = row?.floorKuota ?? 1;
  const kebutuhanJam = row?.kebutuhanJam ?? 0;

  let kuota: number;
  if (blackout) {
    kuota = 0;
  } else if (overrideVal !== null) {
    kuota = Math.max(0, overrideVal);
  } else {
    // Kapasitas bobot KPI: rata-rata skor penilaian periode ini
    const penilaian = await db.penilaianSDM.findMany({
      where: { periode },
      select: { skor: true },
    });
    const avgSkor = penilaian.length > 0
      ? penilaian.reduce((a, p) => a + p.skor, 0) / penilaian.length
      : null;
    const bobotKPI = avgSkor !== null ? 0.8 + Math.min(100, Math.max(0, avgSkor)) / 100 * 0.4 : 1;

    // Faktor kebutuhan: pasokan jam streamer aktif vs kebutuhanJam
    const activeStreamers = await db.karyawan.count({
      where: {
        statusAktif: "AKTIF",
        OR: [{ kategori: "STREAMER" }, { jabatan: { contains: "Streamer", mode: "insensitive" } }],
      },
    });
    const pasokan = activeStreamers * 8 * 24;
    const faktorKebutuhan = kebutuhanJam > 0 && pasokan > 0
      ? Math.min(1.5, Math.max(0.5, pasokan / kebutuhanJam))
      : 1;

    kuota = Math.max(floorKuota, Math.round(kuotaHarian * bobotKPI * faktorKebutuhan));
  }

  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  const terpakai = await db.izin.count({
    where: {
      jenis: "LIBUR_STREAMER",
      status: { in: ["PENDING", "APPROVED"] },
      tanggalMulai: { gte: startOfDay, lte: endOfDay },
    },
  });

  // Ketersediaan per shift sesi live (untuk dropdown dinamis)
  const defaultShiftQuota = typeof cfg.defaultKuotaShift === "number" && cfg.defaultKuotaShift > 0 ? cfg.defaultKuotaShift : 4;
  const dailyShiftQuota = (cfg.dailyShiftQuota ?? {}) as Record<string, any>;
  const customForDay = dailyShiftQuota[ymd] ?? {};
  const sesiDefs = [
    { sesi: "SESI_1", label: "00:00 - 08:00 WIB", key: "q00_08" },
    { sesi: "SESI_2", label: "08:00 - 16:00 WIB", key: "q08_16" },
    { sesi: "SESI_3", label: "16:00 - 00:00 WIB", key: "q16_00" },
  ] as const;
  const availableShifts: ShiftQuota[] = [];
  for (const s of sesiDefs) {
    const custom = customForDay[s.key];
    const maxQ = typeof custom === "number" && custom > 0 ? custom : defaultShiftQuota;
    const used = await db.izin.count({
      where: {
        jenis: `REQUEST_${s.sesi}`,
        status: { in: ["PENDING", "APPROVED"] },
        tanggalMulai: { gte: startOfDay, lte: endOfDay },
      },
    });
    availableShifts.push({ sesi: s.sesi, label: s.label, kuota: maxQ, terpakai: used, sisa: Math.max(0, maxQ - used) });
  }

  return {
    tanggal: ymd,
    periode,
    kuota,
    terpakai,
    sisa: Math.max(0, kuota - terpakai),
    blackout,
    blackoutKind,
    kebutuhanJam,
    availableShifts,
  };
}

/** Validasi kelayakan pengajuan libur untuk satu streamer (gate submit + Cek Kuota). */
export async function checkLiburEligibility(tanggalYMD: string, karyawanId: string, tenantId?: string | null): Promise<EligibilityResult> {
  const base = await getKuotaLibur(tanggalYMD, tenantId);
  const d = parseYMD(tanggalYMD);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  if (base.blackout) {
    const kindMsg = base.blackoutKind === "DOUBLE_DATE"
      ? "Double date tidak boleh libur."
      : base.blackoutKind === "PAYDAY"
        ? "Payday tidak boleh libur."
        : "Tanggal ini blackout, tidak boleh libur.";
    return { ...base, code: "BLACKOUT", message: kindMsg };
  }

  const already = await db.izin.findFirst({
    where: {
      karyawanId,
      jenis: "LIBUR_STREAMER",
      status: { in: ["PENDING", "APPROVED"] },
      tanggalMulai: { gte: startOfDay, lte: endOfDay },
    },
  });
  if (already) {
    return { ...base, code: "ALREADY_BOOKED", message: `Anda sudah memiliki pengajuan libur pada ${tanggalYMD} (status ${already.status}).` };
  }

  // K3: jadwal live aktif di tanggal tersebut
  const jadwalAktif = await db.jadwal.findFirst({
    where: {
      streamerKaryawanId: karyawanId,
      tanggal: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ["DIBATALKAN", "REJECTED"] },
    },
    select: { idJadwal: true },
  });
  if (jadwalAktif) {
    return { ...base, code: "K3_VIOLATION", message: `Tanggal ${tanggalYMD} bentrok dengan jadwal live aktif ${jadwalAktif.idJadwal}. Batalkan/tukar jadwal dulu.` };
  }

  const { start, end } = weekRange(d);
  const weekly = await db.izin.findFirst({
    where: {
      karyawanId,
      jenis: "LIBUR_STREAMER",
      status: { in: ["PENDING", "APPROVED"] },
      tanggalMulai: { gte: start, lte: end },
    },
    select: { tanggalMulai: true },
  });
  if (weekly) {
    const taken = toYMD(new Date(weekly.tanggalMulai));
    return { ...base, code: "WEEKLY_LIMIT", message: `Kuota mingguan Anda sudah terisi di tanggal ${taken}. Silahkan pilih periode minggu berikutnya.` };
  }

  if (base.sisa <= 0) {
    return { ...base, code: "QUOTA_FULL", message: `Kuota libur untuk tanggal ${tanggalYMD} sudah penuh (maksimal ${base.kuota} streamer).` };
  }

  return { ...base, code: "OK", message: "Kuota mingguan Anda masih tersedia." };
}

/** Peta kuota sebulan (untuk calendar history): yyyy-mm-dd -> { kuota, sisa, blackout }. */
export async function getKuotaBulan(bulanYMD: string, tenantId?: string | null) {
  const m = /^(\d{4})-(\d{2})$/.exec(bulanYMD.trim());
  if (!m) throw AppError.badRequest("Format bulan tidak valid (gunakan yyyy-mm).", "VALIDATION_ERROR");
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const map: Record<string, { kuota: number; sisa: number; blackout: boolean }> = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const k = await getKuotaLibur(ymd, tenantId);
    map[ymd] = { kuota: k.kuota, sisa: k.sisa, blackout: k.blackout };
  }
  return { bulan: bulanYMD, map };
}

export async function requireStreamerIdentity() {
  const user = await requireRole("STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL");
  if (!user.karyawanId) throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  return user;
}

export type ShiftSesi = "SESI_1" | "SESI_2" | "SESI_3";

export interface ShiftEligibility {
  code: KuotaCode | "OK";
  message: string;
  shift: ShiftQuota | null;
}

/** Label shift UI ("00:00 - 08:00") -> kode sesi. */
export function mapShiftLabel(label: string): ShiftSesi {
  const t = label.trim();
  if (t.startsWith("00:00")) return "SESI_1";
  if (t.startsWith("08:00")) return "SESI_2";
  if (t.startsWith("16:00")) return "SESI_3";
  throw AppError.badRequest(`Shift tidak dikenal: ${label}`, "VALIDATION_ERROR");
}
/** Validasi satu request sesi live ( dipakai Cek Kuota Mingguan + gate batch submit ). */
export async function checkShiftEligibility(
  tanggalYMD: string,
  sesi: ShiftSesi,
  karyawanId: string,
  tenantId?: string | null,
  batchWeekExtra = 0
): Promise<ShiftEligibility> {
  const base = await getKuotaLibur(tanggalYMD, tenantId);
  const shift = base.availableShifts.find((s) => s.sesi === sesi) ?? null;
  const d = parseYMD(tanggalYMD);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  const liburThatDay = await db.izin.findFirst({
    where: {
      karyawanId,
      jenis: "LIBUR_STREAMER",
      status: { in: ["PENDING", "APPROVED"] },
      tanggalMulai: { gte: startOfDay, lte: endOfDay },
    },
  });
  if (liburThatDay) {
    return { code: "ALREADY_BOOKED", message: `Tanggal ${tanggalYMD} sudah ada pengajuan libur. Batalkan libur dulu untuk request sesi.`, shift };
  }

  const { start: weekStart, end: weekEnd } = weekRange(d);
  const weeklyShifts = await db.izin.count({
    where: {
      karyawanId,
      jenis: { in: ["REQUEST_SESI_1", "REQUEST_SESI_2", "REQUEST_SESI_3"] },
      status: { in: ["PENDING", "APPROVED"] },
      tanggalMulai: { gte: weekStart, lte: weekEnd },
    },
  });
  if (weeklyShifts + batchWeekExtra >= 3) {
    return { code: "WEEKLY_LIMIT", message: "Jatah request sesi live minggu ini sudah habis (maksimal 3 kali per periode Senin–Minggu).", shift };
  }

  if (!shift || shift.sisa <= 0) {
    return { code: "QUOTA_FULL", message: `Kuota request untuk sesi ini pada tanggal ${tanggalYMD} sudah penuh.`, shift };
  }

  return { code: "OK", message: `Kuota tersedia (sisa ${shift.sisa} slot).`, shift };
}

/** Cek Kuota Mingguan batch: re-fetch fresh per form, kembalikan verdict gabungan. */
export async function cekKuotaMingguanBatch(
  requests: { tanggal: string; sesi: ShiftSesi }[],
  karyawanId: string,
  tenantId?: string | null
): Promise<{ ok: boolean; message: string; details: { tanggal: string; sesi: ShiftSesi; code: string; message: string }[] }> {
  // Akumulasi batch per minggu agar 2 form di minggu yang sama ikut dihitung
  const weekCounts = new Map<string, number>();
  const details: { tanggal: string; sesi: ShiftSesi; code: string; message: string }[] = [];
  for (const r of requests) {
    const d = parseYMD(r.tanggal);
    const { start } = weekRange(d);
    const weekKey = toYMD(start);
    const extra = weekCounts.get(weekKey) ?? 0;
    const res = await checkShiftEligibility(r.tanggal, r.sesi, karyawanId, tenantId, extra);
    weekCounts.set(weekKey, extra + 1);
    details.push({ tanggal: r.tanggal, sesi: r.sesi, code: res.code, message: res.message });
  }
  const failed = details.find((x) => x.code !== "OK");
  if (failed) {
    return { ok: false, message: failed.message, details };
  }
  return { ok: true, message: `Semua ${details.length} pengajuan lolos cek kuota mingguan. Silakan submit.`, details };
}
