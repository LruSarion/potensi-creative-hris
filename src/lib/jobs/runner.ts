import { db } from "@/lib/db";
import { logAktivitas } from "@/lib/audit";
import { INCIDENT_SLA_MIN, slaLate } from "@/lib/services/operations";
import { processTelegramBot } from "@/lib/services/telegram-bot";
import type { IncidentStatus, IncidentSeverity } from "@/generated/prisma/enums";

/**
 * Cron job harness.
 * - Locks each job to prevent concurrent/double runs (repo lock + in-DB marker).
 * - Idempotent: safe to run repeatedly; each runner appends to LogAktivitas.
 */

const LOCAL_LOCKS = new Set<string>();
const LOCK_TTL_MS = 60 * 60 * 1000; // 1h safety valve

type JobId = "payout-run" | "billing-close" | "lms-reminders" | "qc-assign" | "report-refresh" | "incident-escalate" | "telegram-poll";

export async function runJob(id: JobId, fn: () => Promise<void>): Promise<{ status: string; started: string }> {
  const started = new Date();
  // Local lock
  if (LOCAL_LOCKS.has(id)) {
    return { status: "skipped:already-running", started: started.toISOString() };
  }
  LOCAL_LOCKS.add(id);
  try {
    // DB marker lock (idempotency window: skip if run within TTL)
    const marker = await db.logAktivitas.findFirst({
      where: { aksi: `CRON_${id}` },
      orderBy: { createdAt: "desc" },
    });
    if (marker && Date.now() - marker.createdAt.getTime() < LOCK_TTL_MS) {
      return { status: "skipped:recent-run", started: started.toISOString() };
    }

    await fn();

    await logAktivitas({
      aksi: `CRON_${id}`,
      detail: JSON.stringify({ ok: true, started: started.toISOString(), tookMs: Date.now() - started.getTime() }),
    });
    return { status: "ok", started: started.toISOString() };
  } catch (e) {
    await logAktivitas({
      aksi: `CRON_${id}`,
      detail: JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
    });
    return { status: "error", started: started.toISOString() };
  } finally {
    LOCAL_LOCKS.delete(id);
  }
}

/**
 * Real cron runners. These operate directly on the DB (no user session — they are
 * only reachable via the secret-gated /api/jobs/run endpoint), and are tenant-scoped.
 */

/** payout-run: create a DRAFT payout run for every tenant with payroll in the period. */
async function runPayoutForPeriod(periode: string): Promise<number> {
  const tenants = await db.tenant.findMany({ select: { id: true } });
  let created = 0;
  for (const t of tenants) {
    const payrolls = await db.payroll.count({ where: { tenantId: t.id, periode } });
    if (payrolls === 0) continue;
    const existing = await db.payoutRun.count({ where: { tenantId: t.id, periode } });
    if (existing > 0) continue;
    const run = await db.payoutRun.create({ data: { tenantId: t.id, periode, status: "DRAFT", totalAmount: 0 } });
    const lines = await db.payroll.findMany({ where: { tenantId: t.id, periode }, select: { karyawanId: true, grossPay: true } });
    let total = 0;
    for (const l of lines) {
      total += Number(l.grossPay);
      await db.payoutLine.create({ data: { payoutRunId: run.id, karyawanId: l.karyawanId, amount: l.grossPay } });
    }
    await db.payoutRun.update({ where: { id: run.id }, data: { totalAmount: total } });
    created++;
  }
  return created;
}

/** billing-close: mark overdue today's-due billing docs SENT if still DRAFT (placeholder policy). */
async function runBillingClose(): Promise<number> {
  const upd = await db.billingDoc.updateMany({
    where: { status: "DRAFT", dueDate: { lte: new Date() } },
    data: { status: "OVERDUE" },
  });
  return upd.count;
}

/** lms-reminders: log an audit marker for enrollments due within 3 days (reminder hook). */
async function runLmsReminders(): Promise<number> {
  const due = await db.enrollment.count({
    where: { dueDate: { gte: new Date(), lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
  });
  if (due > 0) {
    await logAktivitas({ aksi: "LMS_REMINDERS", detail: JSON.stringify({ dueSoon: due }) });
  }
  return due;
}

/** qc-assign: find REVIEW sessions without a session review and log a marker (auto-assign hook). */
async function runQcAssign(): Promise<number> {
  const unreviewed = await db.jadwal.count({
    where: { liveState: "REVIEW", sessionReviews: { none: {} } },
  });
  if (unreviewed > 0) {
    await logAktivitas({ aksi: "QC_ASSIGN", detail: JSON.stringify({ awaitingReview: unreviewed }) });
  }
  return unreviewed;
}

/** report-refresh: touch the audit trail to indicate a report snapshot ran. */
async function runReportRefresh(): Promise<void> {
  await logAktivitas({ aksi: "REPORT_REFRESH", detail: JSON.stringify({ ok: true, ts: new Date().toISOString() }) });
}

/** incident-escalate: auto-escalate unresolved incidents that have breached their SLA. */
async function runIncidentEscalate(): Promise<number> {
  const open: { id: string; severity: IncidentSeverity; status: IncidentStatus; createdAt: Date; title: string }[] =
    await db.incident.findMany({
      where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } },
      select: { id: true, severity: true, status: true, createdAt: true, title: true },
    });
  let escalated = 0;
  for (const inc of open) {
    if (slaLate(inc.createdAt, inc.severity, inc.status)) {
      await db.incident.updateMany({
        where: { id: inc.id, status: { not: "ESCALATED" } },
        data: { status: "ESCALATED" },
      });
      escalated++;
    }
  }
  if (escalated > 0) {
    await logAktivitas({ aksi: "INCIDENT_ESCALATE", detail: JSON.stringify({ escalated }) });
  }
  return escalated;
}

export type { JobId };

export const JOB_REGISTRY: Record<JobId, () => Promise<void>> = {
  "telegram-poll": async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN || "";
    if (!token) return;
    const processed = await processTelegramBot({ botToken: token, botUsername: process.env.TELEGRAM_BOT_USERNAME || "" });
    await logAktivitas({ aksi: "CRON_telegram-poll", detail: JSON.stringify({ processed }) });
  },
  "payout-run": async () => {
    const now = new Date();
    const periode = `${["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][now.getMonth()]} ${now.getFullYear()}`;
    const created = await runPayoutForPeriod(periode);
    await logAktivitas({ aksi: "CRON_payout-run", detail: JSON.stringify({ periode, created }) });
  },
  "billing-close": async () => {
    const changed = await runBillingClose();
    await logAktivitas({ aksi: "CRON_billing-close", detail: JSON.stringify({ changed }) });
  },
  "lms-reminders": async () => {
    await runLmsReminders();
  },
  "qc-assign": async () => {
    await runQcAssign();
  },
  "report-refresh": async () => {
    await runReportRefresh();
  },
  "incident-escalate": async () => {
    await runIncidentEscalate();
  },
};