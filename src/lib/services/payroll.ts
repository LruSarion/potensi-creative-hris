import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import { computeDurationMinutes, computePeriodeBulan } from "@/lib/schedule-rules";
import { matchTier } from "@/lib/tier";
import type { Role } from "@/generated/prisma/enums";

const PAYROLL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"];

const tieringSchema = z.object({
  tier: z.string().min(1),
  jamMinimal: z.number().int().min(0),
  jamMaksimal: z.number().int().min(0),
  ratePerJam: z.number().positive(),
});

export type TieringInput = z.infer<typeof tieringSchema>;

// ---------- TIERING ----------
export async function listTiering() {
  await requireRole();
  return db.tiering.findMany({ orderBy: { jamMinimal: "asc" } });
}

export async function upsertTiering(input: TieringInput) {
  const user = await requireRole(...PAYROLL_ROLES);
  const parsed = tieringSchema.parse(input);
  return db.tiering.upsert({
    where: { tier: parsed.tier },
    update: { ...parsed, tenantId: user.tenantId ?? undefined },
    create: { ...parsed, tenantId: user.tenantId ?? undefined },
  });
}

/**
 * Look up the tier + rate for a given total jam (hours).
 * Returns null if no band matches.
 */
export async function lookupTier(totalJam: number) {
  const bands = await db.tiering.findMany({ orderBy: { jamMinimal: "asc" } });
  if (!bands.length) {
    // Default fallback tiering if table is empty
    return {
      tier: "Standard",
      jamMinimal: 1,
      jamMaksimal: 999,
      ratePerJam: 27500,
    };
  }
  return matchTier(
    bands.map((b) => ({
      tier: b.tier,
      jamMinimal: b.jamMinimal,
      jamMaksimal: b.jamMaksimal,
      ratePerJam: Number(b.ratePerJam),
    })),
    totalJam
  );
}

// ---------- PAYROLL ENGINE ----------
export interface PayrollComputationDetails {
  karyawanId: string;
  namaLengkap: string;
  periode: string;
  totalJamJadwal: number;
  totalJamHadir: number;
  totalJamDihitung: number;
  jumlahSesi: number;
  tier: string;
  ratePerJam: number;
  grossPay: number;
  lemburHours: number;
  lemburPay: number;
  deductions: number;
  netPay: number;
}

/**
 * Compute gross & itemized pay for a streamer for a given period.
 * Accurately analyzes live session schedules & actual check-in attendance.
 */
export async function computePayroll(
  karyawanId: string,
  periode: string,
  deductions: number = 0,
  bonus: number = 0
) {
  const user = await requireRole(...PAYROLL_ROLES);

  const karyawan = await db.karyawan.findFirst({
    where: { id: karyawanId, ...tenantWhere(user) },
  });
  if (!karyawan) throw AppError.notFound("Karyawan tidak ditemukan");

  // Find all jadwal for this streamer in the period
  const jadwalList = await db.jadwal.findMany({
    where: {
      streamerKaryawanId: karyawanId,
      periodeBulan: periode,
      ...tenantWhere(user),
    },
    include: {
      absensi: true,
    },
  });

  // Calculate scheduled duration
  const scheduledMinutes = jadwalList.reduce(
    (sum, j) => sum + computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive),
    0
  );
  const totalJamJadwal = Math.round((scheduledMinutes / 60) * 100) / 100;

  // Calculate actual attendance duration if attendance records exist
  let actualAttendanceMinutes = 0;
  for (const j of jadwalList) {
    const checkIn = j.absensi.find((a) => a.tipe === "CHECK_IN");
    const checkOut = j.absensi.find((a) => a.tipe === "CHECK_OUT");
    if (checkIn && checkOut) {
      const diffMs = checkOut.waktu.getTime() - checkIn.waktu.getTime();
      actualAttendanceMinutes += Math.max(0, Math.round(diffMs / (60 * 1000)));
    } else {
      // If completed or approved without explicit check-out, take scheduled
      actualAttendanceMinutes += computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive);
    }
  }
  const totalJamHadir = Math.round((actualAttendanceMinutes / 60) * 100) / 100;

  // Use actual attendance or scheduled hours (whichever is greater, capped reasonably)
  const totalJamDihitung = Math.max(totalJamHadir, totalJamJadwal);

  // Match Tier
  const tier = await lookupTier(totalJamDihitung);
  if (!tier) {
    throw AppError.badRequest(`Tidak ada tier yang cocok untuk total jam ${totalJamDihitung.toFixed(1)}`);
  }

  const baseGross = Math.round(totalJamDihitung * tier.ratePerJam);

  // Check approved overtime (Lembur) in that period
  const lemburRecords = await db.lembur.findMany({
    where: {
      karyawanId,
      status: "APPROVED",
    },
  });
  const lemburMinutes = lemburRecords.reduce(
    (sum, l) => sum + computeDurationMinutes(l.jamMulai, l.jamSelesai),
    0
  );
  const lemburHours = Math.round((lemburMinutes / 60) * 100) / 100;
  // Overtime standard rate: 1.5x base hourly tier rate
  const lemburPay = Math.round(lemburHours * tier.ratePerJam * 1.5);

  const grossPay = baseGross + lemburPay + bonus;
  const netPay = Math.max(0, grossPay - deductions);

  const record = await db.payroll.upsert({
    where: { karyawanId_periode: { karyawanId, periode } },
    update: {
      tenantId: user.tenantId ?? undefined,
      totalJam: totalJamDihitung,
      tier: tier.tier,
      ratePerJam: tier.ratePerJam,
      grossPay,
    },
    create: {
      tenantId: user.tenantId ?? undefined,
      karyawanId,
      periode,
      totalJam: totalJamDihitung,
      tier: tier.tier,
      ratePerJam: tier.ratePerJam,
      grossPay,
    },
    include: {
      karyawan: true,
    },
  });

  const details: PayrollComputationDetails = {
    karyawanId,
    namaLengkap: karyawan.namaLengkap,
    periode,
    totalJamJadwal,
    totalJamHadir,
    totalJamDihitung,
    jumlahSesi: jadwalList.length,
    tier: tier.tier,
    ratePerJam: tier.ratePerJam,
    grossPay,
    lemburHours,
    lemburPay,
    deductions,
    netPay,
  };

  return {
    payroll: record,
    details,
  };
}

/**
 * Compute payroll for ALL streamers who have schedules in a given period in one batch.
 */
export async function computePeriodBatchPayroll(periode: string) {
  const user = await requireRole(...PAYROLL_ROLES);

  // Find distinct streamer IDs with jadwal in this period
  const jadwalRows = await db.jadwal.findMany({
    where: {
      periodeBulan: periode,
      streamerKaryawanId: { not: null },
      ...tenantWhere(user),
    },
    select: { streamerKaryawanId: true },
  });

  const streamerIds = Array.from(
    new Set(jadwalRows.map((j) => j.streamerKaryawanId).filter(Boolean) as string[])
  );

  if (streamerIds.length === 0) {
    // If no specific schedule rows found by string, try all active streamers
    const allStreamers = await db.karyawan.findMany({
      where: {
        statusAktif: "AKTIF",
        ...tenantWhere(user),
      },
      select: { id: true },
    });
    for (const s of allStreamers) {
      streamerIds.push(s.id);
    }
  }

  const results: PayrollComputationDetails[] = [];
  for (const id of streamerIds) {
    try {
      const res = await computePayroll(id, periode);
      results.push(res.details);
    } catch {
      // skip or continue
    }
  }

  return {
    periode,
    totalStreamers: results.length,
    totalGrossPayout: results.reduce((s, r) => s + r.grossPay, 0),
    totalLiveHours: results.reduce((s, r) => s + r.totalJamDihitung, 0),
    results,
  };
}

export async function listPayroll(params?: { periode?: string }) {
  const user = await requireRole(...PAYROLL_ROLES);
  return db.payroll.findMany({
    where: {
      ...tenantWhere(user),
      ...(params?.periode ? { periode: params.periode } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { karyawan: true },
  });
}

export async function getPayrollSummary(periode: string) {
  const user = await requireRole(...PAYROLL_ROLES);
  const rows = await db.payroll.findMany({
    where: {
      periode,
      ...tenantWhere(user),
    },
    include: { karyawan: true },
  });

  const totalGross = rows.reduce((s, r) => s + Number(r.grossPay), 0);
  const totalJam = rows.reduce((s, r) => s + Number(r.totalJam), 0);
  const count = rows.length;
  const avgRate = totalJam > 0 ? Math.round(totalGross / totalJam) : 0;

  return {
    periode,
    count,
    totalGross,
    totalJam: Math.round(totalJam * 10) / 10,
    avgRate,
    rows,
  };
}

/** Convenience: compute period label for a date. */
export function periodeForDate(d: Date): string {
  return computePeriodeBulan(d);
}
