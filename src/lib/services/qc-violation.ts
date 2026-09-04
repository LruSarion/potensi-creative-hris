import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/services/telegram";
import { normalizeNotifPrefs } from "@/lib/notification-types";
import { sendQCViolationEmail } from "@/lib/services/email";
import type { Role } from "@/generated/prisma/enums";

const QC_ROLES: Role[] = ["QC_MANAGER", "QC_REVIEWER", "SUPER_ADMIN", "ADMIN_OPERASIONAL"];
const QC_APPROVER_ROLES: Role[] = ["QC_MANAGER", "SUPER_ADMIN", "ADMIN_OPERASIONAL"];
const STREAMER_ROLES: Role[] = ["STREAMER", "SUPER_ADMIN", "ADMIN_OPERASIONAL"];

const violationSchema = z.object({
  streamerKaryawanId: z.string().min(1),
  jadwalId: z.string().optional().nullable(),
  category: z.enum(["GROOMING", "ATTITUDE", "LANGUAGE", "DRESS_CODE", "PRODUCT_HANDLING", "PLATFORM_RULE", "TECHNICAL", "OTHER"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().default("MEDIUM"),
  description: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  // Free-text category (required when category = OTHER).
  categoryLabel: z.string().optional().nullable(),
  // When the violation actually happened (manual QC input; defaults to now).
  occurredAt: z.string().optional().nullable(),
});

export type QcViolationInput = z.infer<typeof violationSchema>;

/** Human-readable label for a violation: free-text label when present, else the enum label. */
function resolveCategoryLabel(category: string, categoryLabel?: string | null): string {
  if (categoryLabel && categoryLabel.trim()) return categoryLabel.trim();
  return VIOLATION_LABELS[category] ?? category;
}

/** QC reviewer: record a live-streaming violation with photo evidence. Starts as OPEN (pending confirmation). */
export async function createViolation(input: QcViolationInput) {
  const user = await requireRole(...QC_ROLES);
  const parsed = violationSchema.parse(input);
  if (parsed.category === "OTHER" && !(parsed.categoryLabel ?? "").trim()) {
    throw AppError.badRequest("Kategori Lainnya wajib diisi manual");
  }
  const streamer = await db.karyawan.findFirst({
    where: { id: parsed.streamerKaryawanId, ...tenantWhere(user) },
  });
  if (!streamer) throw AppError.notFound("Streamer tidak ditemukan");
  const violation = await db.qcViolation.create({
    data: {
      tenantId: user.tenantId || undefined,
      jadwalId: parsed.jadwalId ?? null,
      streamerKaryawanId: parsed.streamerKaryawanId,
      category: parsed.category,
      categoryLabel: parsed.categoryLabel ?? null,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : null,
      severity: parsed.severity ?? "MEDIUM",
      description: parsed.description ?? null,
      photoUrl: parsed.photoUrl ?? null,
      videoUrl: parsed.videoUrl ?? null,
      capturedById: user.id,
    },
    include: { streamer: true },
  });

  // Auto-notify: the streamer (via their karyawan link), every SUPER_ADMIN, and every TRAINER.
  const catLabel = resolveCategoryLabel(parsed.category, parsed.categoryLabel);
  const title = `Pelanggaran QC: ${catLabel}`;
  const message = `${streamer.namaLengkap} mendapat pelanggaran ${catLabel} (${parsed.severity}) — menunggu konfirmasi QC Manager. ${parsed.description ?? ""}`;
  const link = "/qc-violations";

  const recipients: { userId?: string; karyawanId?: string }[] = [];
  if (streamer.userId) recipients.push({ userId: streamer.userId });
  const staff = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "TRAINER"] }, tenantId: user.tenantId ?? undefined },
    select: { id: true },
  });
  for (const u of staff) if (u.id !== user.id) recipients.push({ userId: u.id });

  for (const r of recipients) {
    await db.logAktivitas.create({
      data: {
        tenantId: user.tenantId || undefined,
        userId: r.userId,
        aksi: "NOTIFICATION",
        detail: JSON.stringify({
          targetUserId: r.userId ?? null,
          targetKaryawanId: r.karyawanId ?? null,
          title,
          message,
          link,
          type: "QC_VIOLATION",
        }),
      },
    }).catch(() => {});
  }

  // Push to bound Telegram chats (respects per-user prefs for QC_VIOLATION).
  await pushViolationTelegram(recipients, title, message, link, user.tenantId);

  // NOTE: the penalty email is sent when a QC Manager CONFIRMS the violation,
  // not at creation time — pending violations carry no consequences yet.

  return violation;
}

async function pushViolationTelegram(
  recipients: { userId?: string; karyawanId?: string }[],
  title: string,
  message: string,
  link: string,
  tenantId?: string
) {
  try {
    const userIds = recipients.map((r) => r.userId).filter(Boolean) as string[];
    if (userIds.length === 0) return;
    const users = await db.user.findMany({
      where: { id: { in: userIds }, telegramChatId: { not: null } },
      select: { telegramChatId: true, telegramNotifPrefs: true },
    });
    if (users.length === 0) return;
    const cfg = await getTelegramConfig({ tenantId });
    const text = [`📢 ${title}`, message, link ? `🔗 ${link}` : null].filter(Boolean).join("\n");
    for (const u of users) {
      if (!u.telegramChatId) continue;
      const prefs = normalizeNotifPrefs(u.telegramNotifPrefs);
      if (prefs.QC_VIOLATION === false) continue;
      await sendTelegramMessage(u.telegramChatId, text, cfg);
    }
  } catch {
    // Telegram delivery must never break QC recording.
  }
}

/** List violations (QC sees all; streamer sees own). */
export async function listViolations(params?: { streamerKaryawanId?: string }) {
  const user = await requireRole();
  const isQc = QC_ROLES.includes(user.role);
  const where: Record<string, unknown> = { ...tenantWhere(user) };
  if (isQc) {
    if (params?.streamerKaryawanId) where.streamerKaryawanId = params.streamerKaryawanId;
  } else {
    // Streamers only see their own violations.
    where.streamerKaryawanId = user.karyawanId ?? "__none__";
  }
  return db.qcViolation.findMany({
    where,
    include: { streamer: { select: { id: true, namaLengkap: true, idKaryawan: true } }, jadwal: { select: { idJadwal: true, platform: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Confirm or close a violation.
 * CONFIRM: QC_MANAGER/Admin validates a pending (OPEN) violation — it becomes official,
 *          the penalty email is sent, and the streamer is notified.
 * CLOSE:   marks a confirmed violation as resolved.
 */
export async function updateViolationStatus(id: string, action: "confirm" | "close") {
  const user = await requireRole(...QC_APPROVER_ROLES);
  const v = await db.qcViolation.findFirst({
    where: { id, ...tenantWhere(user) },
    include: { streamer: true },
  });
  if (!v) throw AppError.notFound("Pelanggaran tidak ditemukan");

  if (action === "confirm") {
    if (v.status === "CONFIRMED" || v.status === "CLOSED") {
      throw AppError.conflict("Pelanggaran sudah dikonfirmasi");
    }
    const confirmed = await db.qcViolation.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedById: user.id, confirmedAt: new Date() },
      include: { streamer: true },
    });

    // Penalty email now that the violation is official.
    const catLabel = resolveCategoryLabel(confirmed.category, confirmed.categoryLabel);
    if (confirmed.streamer.email) {
      sendQCViolationEmail({
        to: confirmed.streamer.email,
        nama: confirmed.streamer.namaLengkap,
        jenisPelanggaran: catLabel,
        poinPenalti: confirmed.severity === "CRITICAL" || confirmed.severity === "HIGH" ? 15 : confirmed.severity === "MEDIUM" ? 10 : 5,
        catatan: confirmed.description ?? "Evaluasi audit QC siaran live",
        tanggal: (confirmed.occurredAt ?? confirmed.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      }).catch((e) => console.error("[QC Email Error]:", e));
    }

    // Notify the streamer + staff that the violation is confirmed.
    const title = `Pelanggaran QC Dikonfirmasi: ${catLabel}`;
    const message = `Pelanggaran ${catLabel} atas ${confirmed.streamer.namaLengkap} telah dikonfirmasi QC Manager dan berlaku resmi.`;
    const link = "/qc-violations";
    const recipients: { userId?: string }[] = [];
    if (confirmed.streamer.userId) recipients.push({ userId: confirmed.streamer.userId });
    const staff = await db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "TRAINER"] }, tenantId: user.tenantId ?? undefined },
      select: { id: true },
    });
    for (const u of staff) if (u.id !== user.id) recipients.push({ userId: u.id });
    for (const r of recipients) {
      await db.logAktivitas.create({
        data: {
          tenantId: user.tenantId || undefined,
          userId: r.userId,
          aksi: "NOTIFICATION",
          detail: JSON.stringify({
            targetUserId: r.userId ?? null,
            targetKaryawanId: null,
            title,
            message,
            link,
            type: "QC_VIOLATION",
          }),
        },
      }).catch(() => {});
    }
    await pushViolationTelegram(recipients, title, message, link, user.tenantId);

    return confirmed;
  }

  // close
  return db.qcViolation.update({ where: { id }, data: { status: "CLOSED" } });
}

/** Streamer's violation summary (count by category) for the dashboard. Only confirmed/closed violations count. */
export async function myViolationSummary() {
  const user = await requireRole(...STREAMER_ROLES);
  if (!user.karyawanId) return { count: 0, byCategory: {}, pending: 0, critical: 0 };
  const rows = await db.qcViolation.findMany({
    where: { streamerKaryawanId: user.karyawanId },
    select: { category: true, severity: true, status: true },
  });
  const byCategory: Record<string, number> = {};
  let critical = 0;
  let pending = 0;
  let confirmedCount = 0;
  for (const r of rows) {
    if (r.status === "OPEN") {
      pending++;
      continue;
    }
    // CONFIRMED | CLOSED | legacy REVIEWED (treated as confirmed) count as official.
    confirmedCount++;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    if (r.severity === "HIGH" || r.severity === "CRITICAL") critical++;
  }
  return { count: confirmedCount, byCategory, pending, critical };
}

/** Streamers currently LIVE (for QC reviewer to pick from). */
export async function listLiveStreamers() {
  const user = await requireRole(...QC_ROLES);
  return db.jadwal.findMany({
    where: { ...tenantWhere(user), liveState: "LIVE" },
    include: {
      streamerKaryawan: { select: { id: true, namaLengkap: true, idKaryawan: true } },
      client: { select: { namaClient: true } },
    },
    orderBy: { jamMulaiLive: "desc" },
  });
}

// Human-readable labels for the UI.
export const VIOLATION_LABELS: Record<string, string> = {
  GROOMING: "Grooming / Penampilan",
  ATTITUDE: "Attitude / Sikap",
  LANGUAGE: "Language / Ucapan",
  DRESS_CODE: "Dress Code / Pakaian",
  PRODUCT_HANDLING: "Penanganan Produk",
  PLATFORM_RULE: "Aturan Platform",
  TECHNICAL: "Teknis",
  OTHER: "Lainnya",
};
