import { db } from "@/lib/db";
import { logAktivitas } from "@/lib/audit";
import { INCIDENT_SLA_MIN, slaLate } from "@/lib/services/operations";
import { processTelegramBot } from "@/lib/services/telegram-bot";
import { getBotConfig } from "@/lib/services/telegram";
import type { IncidentStatus, IncidentSeverity } from "@/generated/prisma/enums";

/**
 * Cron job harness.
 * - Locks each job to prevent concurrent/double runs (repo lock + in-DB marker).
 * - Idempotent: safe to run repeatedly; each runner appends to LogAktivitas.
 */

const LOCAL_LOCKS = new Set<string>();
const LOCK_TTL_MS = 60 * 60 * 1000; // 1h safety valve

type JobId = "payout-run" | "billing-close" | "lms-reminders" | "qc-assign" | "report-refresh" | "incident-escalate" | "check-in-reminders" | "auto-checkout" | "telegram-poll" | "hr-reminders";

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

/** check-in-reminders: sends 60-min advance reminders to streamers and 30-min escalations to SPVs */
async function runCheckInReminders(): Promise<void> {
  const now = new Date();
  
  // 1. Reminders for streamers: 60 minutes before jamMulaiLive
  const in60Mins = new Date(now.getTime() + 60 * 60 * 1000);
  const in65Mins = new Date(now.getTime() + 65 * 60 * 1000);
  
  const toRemind = await db.jadwal.findMany({
    where: {
      liveState: "SCHEDULED",
      reminderStreamerSent: false,
      jamMulaiLive: {
        gte: in60Mins,
        lt: in65Mins
      }
    },
    select: { id: true, jamMulaiLive: true, streamerKaryawanId: true }
  });

  let remindersSent = 0;
  for (const j of toRemind) {
    if (j.streamerKaryawanId) {
      await db.logAktivitas.create({
        data: {
          aksi: "NOTIFICATION",
          detail: JSON.stringify({
            targetKaryawanId: j.streamerKaryawanId,
            title: "Pengingat Check-in",
            message: `Jadwal live Anda akan dimulai pada ${j.jamMulaiLive.toLocaleTimeString("id-ID")}. Harap segera melakukan check-in minimal 30 menit sebelum sesi.`,
            link: "/streamer-dashboard"
          })
        }
      });
      await db.jadwal.update({
        where: { id: j.id },
        data: { reminderStreamerSent: true }
      });
      remindersSent++;
    }
  }

  // 2. Escalations to SPV/Admin: 30 minutes before jamMulaiLive if NO check-in
  const in30Mins = new Date(now.getTime() + 30 * 60 * 1000);
  const in35Mins = new Date(now.getTime() + 35 * 60 * 1000);
  
  const toEscalate = await db.jadwal.findMany({
    where: {
      liveState: "SCHEDULED",
      reminderSpvSent: false,
      jamMulaiLive: {
        gte: in30Mins,
        lt: in35Mins
      },
      absensi: {
        none: {
          tipe: "CHECK_IN"
        }
      }
    },
    select: { id: true, jamMulaiLive: true, streamerKaryawan: { select: { namaLengkap: true } } }
  });

  let escalationsSent = 0;
  if (toEscalate.length > 0) {
    // Find admins to notify
    const admins = await db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN_OPERASIONAL"] } },
      select: { id: true }
    });

    for (const j of toEscalate) {
      for (const admin of admins) {
        await db.logAktivitas.create({
          data: {
            aksi: "NOTIFICATION",
            detail: JSON.stringify({
              targetUserId: admin.id,
              title: "Eskalasi: Streamer Belum Check-in",
              message: `Streamer ${j.streamerKaryawan?.namaLengkap || 'Unknown'} belum melakukan check-in untuk jadwal live jam ${j.jamMulaiLive.toLocaleTimeString("id-ID")}.`,
              link: "/admin/jadwal"
            })
          }
        });
      }
      await db.jadwal.update({
        where: { id: j.id },
        data: { reminderSpvSent: true }
      });
      escalationsSent++;
    }
  }

  if (remindersSent > 0 || escalationsSent > 0) {
    await logAktivitas({ aksi: "CHECK_IN_REMINDERS", detail: JSON.stringify({ remindersSent, escalationsSent }) });
  }
}

/** auto-checkout: automatically checks out streamers who forgot to check out 2 hours after scheduled end time */
async function runAutoCheckout(): Promise<void> {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const abandonedSessions = await db.jadwal.findMany({
    where: {
      liveState: "LIVE",
      jamSelesaiLive: { lt: twoHoursAgo }
    },
    include: {
      absensi: {
        where: { tipe: "CHECK_IN" },
        orderBy: { waktu: "desc" },
        take: 1
      }
    }
  });

  let processedCount = 0;

  for (const j of abandonedSessions) {
    if (!j.streamerKaryawanId || j.absensi.length === 0) continue;
    
    const lastCheckIn = j.absensi[0];

    await db.$transaction(async (tx) => {
      await tx.absensi.create({
        data: {
          tenantId: j.tenantId,
          karyawanId: j.streamerKaryawanId!,
          jadwalId: j.id,
          tipe: "CHECK_OUT",
          kategori: lastCheckIn.kategori,
          catatan: "Auto check-out by System",
          reportedGmv: 0,
        }
      });

      const durationSec = Math.floor((j.jamSelesaiLive.getTime() - lastCheckIn.waktu.getTime()) / 1000);

      await tx.jadwal.update({
        where: { id: j.id },
        data: {
          liveState: "REVIEW",
          status: "SELESAI",
          durationSec: Math.max(0, durationSec)
        }
      });

      await tx.sessionStateLog.create({
        data: {
          tenantId: j.tenantId,
          jadwalId: j.id,
          fromState: "LIVE",
          toState: "REVIEW",
          note: "Auto-transition on Auto-Checkout (Session abandoned)"
        }
      });
    });
    processedCount++;
  }

  if (processedCount > 0) {
    await logAktivitas({ aksi: "AUTO_CHECKOUT", detail: JSON.stringify({ processedCount }) });
  }
}

// ---------- HR Reminders: Contract expiry + Payroll near-limit alerts ----------

async function runHrReminders() {
  const now = new Date();
  const in30days = new Date(now);
  in30days.setDate(in30days.getDate() + 30);

  // 1. Contract expiry: find employees whose contract ends within 30 days
  const expiring = await db.karyawan.findMany({
    where: { endDate: { gte: now, lte: in30days }, status: "ACTIVE" },
    select: { id: true, namaLengkap: true, endDate: true },
  });

  for (const k of expiring) {
    const daysLeft = Math.ceil(((k.endDate?.getTime() ?? 0) - now.getTime()) / (1000 * 60 * 60 * 24));
    await db.notification.create({
      data: {
        targetKaryawanId: null,
        title: `⚠️ Kontrak Hampir Berakhir: ${k.namaLengkap}`,
        message: `Kontrak ${k.namaLengkap} akan berakhir dalam ${daysLeft} hari. Segera proses perpanjangan.`,
        link: "/view-data",
        type: "SYSTEM",
      },
    }).catch(() => undefined);
  }

  // 2. Payroll near Tier 4: find streamers whose current month gross pay is >= 90% of tier4 threshold
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const tieringList = await db.tiering.findMany({ orderBy: { jamMinimal: "asc" } });
  const tier4 = tieringList.length >= 4 ? tieringList[3] : null;
  if (tier4) {
    const threshold90 = tier4.jamMinimal * 0.9;
    const jadwalRows = await db.jadwal.groupBy({
      by: ["streamerKaryawanId"],
      where: { tanggal: { gte: monthStart, lt: monthEnd }, status: { notIn: ["DIBATALKAN", "REJECTED"] }, streamerKaryawanId: { not: null } },
      _sum: { durationSec: true },
    });
    for (const row of jadwalRows) {
      const totalJam = (row._sum.durationSec ?? 0) / 3600;
      if (totalJam >= threshold90 && row.streamerKaryawanId) {
        const k = await db.karyawan.findUnique({ where: { id: row.streamerKaryawanId }, select: { namaLengkap: true } });
        await db.notification.create({
          data: {
            targetKaryawanId: null,
            title: `🚨 Streamer Mendekati Batas Tier 4: ${k?.namaLengkap}`,
            message: `${k?.namaLengkap} sudah akumulasi ${totalJam.toFixed(1)} jam bulan ini (ambang Tier 4: ${tier4.jamMinimal} jam). Pertimbangkan pengendalian jadwal.`,
            link: "/input-jadwal",
            type: "SYSTEM",
          },
        }).catch(() => undefined);
      }
    }
  }

  await logAktivitas({
    aksi: "CRON_hr-reminders",
    detail: JSON.stringify({ contractsExpiring: expiring.length }),
  });
}

export type { JobId };

export const JOB_REGISTRY: Record<JobId, () => Promise<void>> = {
  "telegram-poll": async () => {
    const cfg = await getBotConfig();
    if (!cfg.botToken) return;
    const processed = await processTelegramBot(cfg);
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
  "check-in-reminders": async () => {
    await runCheckInReminders();
  },
  "auto-checkout": async () => {
    await runAutoCheckout();
  },
  "hr-reminders": async () => {
    await runHrReminders();
  },
};