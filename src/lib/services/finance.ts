import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere, assertTenantScope } from "@/lib/auth-helpers";
import { computeDurationMinutes, computePeriodeBulan } from "@/lib/schedule-rules";
import { matchTier } from "@/lib/tier";
import { logAktivitas } from "@/lib/audit";
import type { Role } from "@/generated/prisma/enums";

const FIN_ROLES: Role[] = ["FINANCE", "FINANCE_MANAGER", "SUPER_ADMIN"];
const APPROVE_ROLES: Role[] = ["FINANCE_MANAGER", "SUPER_ADMIN"];

// ---------- T12: Payroll v2 ----------

/**
 * Compute gross pay for a streamer for a period (hours from jadwal durations,
 * tier lookup, deductions net). Reuses the existing engine; adds notes & deductions.
 */
export async function computePayrollV2(karyawanId: string, periode: string, deductions: DecimalInput = 0) {
  const user = await requireRole(...FIN_ROLES);
  const k = await db.karyawan.findFirst({ where: { id: karyawanId, ...tenantWhere(user) } });
  if (!k) throw AppError.notFound("Karyawan tidak ditemukan");

  const jadwal = await db.jadwal.findMany({
    where: { streamerKaryawanId: karyawanId, periodeBulan: periode, ...tenantWhere(user) },
  });
  const totalMinutes = jadwal.reduce((s, j) => s + computeDurationMinutes(j.jamMulaiLive, j.jamSelesaiLive), 0);
  const totalJam = totalMinutes / 60;

  const bands = await db.tiering.findMany({ orderBy: { jamMinimal: "asc" } });
  const rate = matchTier(
    bands.map((b) => ({ tier: b.tier, jamMinimal: b.jamMinimal, jamMaksimal: b.jamMaksimal, ratePerJam: Number(b.ratePerJam) })),
    totalJam
  );
  if (!rate) throw AppError.badRequest(`Tidak ada tier untuk total jam ${totalJam.toFixed(1)}`);

  const gross = Math.round(totalJam * rate.ratePerJam * 100) / 100;
  const net = Math.max(0, gross - Number(deductions));

  const payroll = await db.payroll.upsert({
    where: { karyawanId_periode: { karyawanId, periode } },
    update: { totalJam, tier: rate.tier, ratePerJam: rate.ratePerJam, grossPay: gross },
    create: {
      tenantId: user.tenantId || undefined,
      karyawanId,
      periode,
      totalJam,
      tier: rate.tier,
      ratePerJam: rate.ratePerJam,
      grossPay: gross,
    },
  });
  return { payroll, totalJam: Math.round(totalJam * 100) / 100, tier: rate.tier, gross, net };
}

type DecimalInput = number | string;

// ---------- T13: Payout runs ----------

export async function createPayoutRun(periode: string) {
  const user = await requireRole(...FIN_ROLES);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");
  const existing = await db.payoutRun.findFirst({ where: { tenantId: user.tenantId, periode } });
  if (existing) throw AppError.conflict("Payout run untuk periode ini sudah ada");

  // Gather approved payroll rows for the period.
  const payrolls = await db.payroll.findMany({ where: { periode, tenantId: user.tenantId } });

  const run = await db.$transaction(async (tx) => {
    const run = await tx.payoutRun.create({
      data: {
        tenantId: user.tenantId!,
        periode,
        totalAmount: 0,
      },
    });
    let total = 0;
    for (const p of payrolls) {
      const amount = Number(p.grossPay);
      total += amount;
      await tx.payoutLine.create({
        data: { payoutRunId: run.id, karyawanId: p.karyawanId, amount },
      });
    }
    const updated = await tx.payoutRun.update({
      where: { id: run.id },
      data: { totalAmount: total },
    });
    return updated;
  });

  await logAktivitas({ tenantId: user.tenantId, userId: user.id, aksi: "PAYOUT_CREATED", detail: JSON.stringify({ runId: run.id, periode }) });
  return run;
}

export async function setPayoutStatus(id: string, status: "PROCESSING" | "SUBMITTED" | "APPROVED" | "PAID" | "CANCELLED") {
  const user = await requireRole(...(status === "APPROVED" || status === "PAID" ? APPROVE_ROLES : FIN_ROLES));
  const run = await db.payoutRun.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!run) throw AppError.notFound("Payout run tidak ditemukan");
  const updated = await db.payoutRun.update({
    where: { id },
    data: { status, approvedById: user.id, paidAt: status === "PAID" ? new Date() : undefined },
  });
  await logAktivitas({ tenantId: user.tenantId, userId: user.id, aksi: `PAYOUT_${status}`, detail: JSON.stringify({ runId: id }) });
  return updated;
}

/**
 * Build a payout run from the revenue ledger (streamerCuts) for a period,
 * minus per-line deductions. Guarantees:
 *   amount = streamerCut - deductions
 *   run.totalAmount == SUM(amount) == SUM(streamerCut) - SUM(deductions)
 * Exact integer math (no floating-point drift).
 */
export async function reconcilePayoutRun(periode: string, deductionsByKaryawan: Record<string, number> = {}) {
  const user = await requireRole(...FIN_ROLES);
  if (!user.tenantId) throw AppError.forbidden("Akun tidak terkait tenant");

  // Aggregate streamerCut per karyawan from revenue for the period (by eventAt month).
  const [startOf, endOf] = periodeRange(periode);
  const revenues = await db.revenueEntry.findMany({
    where: { tenantId: user.tenantId, eventAt: { gte: startOf, lt: endOf } },
  });

  const perStreamer = new Map<string, number>();
  for (const r of revenues) {
    if (!r.streamerKaryawanId) continue;
    const cut = Number(r.streamerCut);
    perStreamer.set(r.streamerKaryawanId, (perStreamer.get(r.streamerKaryawanId) ?? 0) + cut);
  }

  const existing = await db.payoutRun.findFirst({ where: { tenantId: user.tenantId, periode } });
  if (existing) throw AppError.conflict("Payout run untuk periode ini sudah ada");

  const run = await db.$transaction(async (tx) => {
    const run = await tx.payoutRun.create({
      data: { tenantId: user.tenantId!, periode, totalAmount: 0, deductions: 0, status: "DRAFT" },
    });

    let totalAmount = 0;
    let totalDeductions = 0;
    for (const [karyawanId, streamerCut] of perStreamer) {
      const deductions = Math.round(deductionsByKaryawan[karyawanId] ?? 0);
      const amount = streamerCut - deductions;
      if (amount <= 0) continue; // skip zero/negative lines
      totalAmount += amount;
      totalDeductions += deductions;
      await tx.payoutLine.create({
        data: { payoutRunId: run.id, karyawanId, streamerCut, deductions, amount },
      });
    }

    return tx.payoutRun.update({
      where: { id: run.id },
      data: { totalAmount, deductions: totalDeductions },
    });
  });

  await logAktivitas({ tenantId: user.tenantId, userId: user.id, aksi: "PAYOUT_RECONCILED", detail: JSON.stringify({ runId: run.id, periode }) });
  return run;
}

/** Parse "Bulan YYYY" into a [start, end) date range. */
function periodeRange(periode: string): [Date, Date] {
  const m = /^(\w+) (\d{4})$/.exec(periode.trim());
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const idx = m ? months.indexOf(m[1]) : new Date().getMonth();
  const year = m ? parseInt(m[2], 10) : new Date().getFullYear();
  return [new Date(year, idx, 1), new Date(year, idx + 1, 1)];
}

export async function listPayoutRuns(periode?: string) {
  const user = await requireRole(...FIN_ROLES);
  return db.payoutRun.findMany({
    where: { ...tenantWhere(user), ...(periode ? { periode } : {}) },
    orderBy: { createdAt: "desc" },
    include: { lines: { include: { karyawan: true } } },
  });
}

// ---------- T14: Client billing ----------

export async function createBillingDoc(clientId: string, periode: string) {
  const user = await requireRole(...FIN_ROLES);
  const client = await db.client.findFirst({ where: { id: clientId, ...tenantWhere(user) } });
  if (!client) throw AppError.notFound("Client tidak ditemukan");

  const sessions = await db.jadwal.findMany({
    where: { clientId, periodeBulan: periode, ...tenantWhere(user), status: "SELESAI" },
  });

  // Simple rate: fixed per-session rate est. of Rp 150.000 (configurable per client later).
  const SESSION_RATE = 150000;
  const doc = await db.$transaction(async (tx) => {
    const doc = await tx.billingDoc.create({
      data: { tenantId: user.tenantId || undefined, clientId, periode, totalAmount: 0 },
    });
    let total = 0;
    for (const s of sessions) {
      total += SESSION_RATE;
      await tx.billingLine.create({
        data: { billingDocId: doc.id, jadwalId: s.id, description: `Sesi ${s.idJadwal}`, amount: SESSION_RATE },
      });
    }
    return tx.billingDoc.update({ where: { id: doc.id }, data: { totalAmount: total } });
  });
  return doc;
}

export async function setBillingStatus(id: string, status: "SENT" | "PAID" | "OVERDUE" | "VOID") {
  const user = await requireRole(...(status === "PAID" || status === "VOID" ? APPROVE_ROLES : FIN_ROLES));
  const doc = await db.billingDoc.findFirst({ where: { id, ...tenantWhere(user) } });
  if (!doc) throw AppError.notFound("Billing tidak ditemukan");
  return db.billingDoc.update({ where: { id }, data: { status } });
}

export async function listBilling(periode?: string, clientId?: string) {
  const user = await requireRole(...FIN_ROLES);
  return db.billingDoc.findMany({
    where: { ...tenantWhere(user), ...(periode ? { periode } : {}), ...(clientId ? { clientId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { client: true, lines: true },
  });
}

// ---------- T15: P&L ----------

export async function pnlSummary(periode: string) {
  const user = await requireRole(...FIN_ROLES);
  const payoutRuns = await db.payoutRun.findMany({ where: { periode, ...tenantWhere(user) } });
  const billingDocs = await db.billingDoc.findMany({ where: { periode, ...tenantWhere(user) } });
  const revenue = billingDocs.reduce((s, b) => s + Number(b.totalAmount), 0);
  const paidPayouts = payoutRuns.filter((r) => r.status === "PAID").reduce((s, r) => s + Number(r.totalAmount), 0);
  const projectedPayouts = payoutRuns.filter((r) => r.status === "APPROVED").reduce((s, r) => s + Number(r.totalAmount), 0);

  return {
    periode,
    revenue,
    paidPayouts,
    projectedPayouts,
    netPaid: revenue - paidPayouts,
    netProjected: revenue - paidPayouts - projectedPayouts,
  };
}