import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, requirePortal } from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/services/telegram";
import { normalizeNotifPrefs, type NotificationType } from "@/lib/notification-types";

/**
 * Phase 6 integration surface: notifications (T32), permission admin (T34),
 * and hardening helpers (T36). Platform analytics live in services/analytics.ts (T33).
 */

// ---------- T32: Cross-portal notifications (inbox = LogAktivitas) ----------

const notifySchema = z.object({
  targetUserId: z.string().optional().nullable(),
  targetKaryawanId: z.string().optional().nullable(),
  title: z.string().min(1),
  message: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
  type: z.string().optional(),
});

export type NotifyInput = z.input<typeof notifySchema>;

export async function createNotification(input: NotifyInput) {
  // Internal system notifications are written by services/cron, not by arbitrary users.
  const caller = await requireRole("SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION", "FINANCE", "TRAINER", "QC_MANAGER");
  const parsed = notifySchema.parse({ type: "APPROVAL", ...input });
  const row = await db.logAktivitas.create({
    data: {
      aksi: "NOTIFICATION",
      detail: JSON.stringify({
        targetUserId: parsed.targetUserId ?? null,
        targetKaryawanId: parsed.targetKaryawanId ?? null,
        title: parsed.title,
        message: parsed.message ?? null,
        link: parsed.link ?? null,
        type: parsed.type,
      }),
    },
  });

  // Also push to the recipient's bound Telegram chat, if configured + enabled.
  await pushTelegramForTarget(parsed, caller.tenantId);
  return row;
}

async function pushTelegramForTarget(parsed: z.infer<typeof notifySchema>, tenantId?: string) {  try {
    const type = parsed.type as NotificationType;
    const title = parsed.title;
    const message = parsed.message ?? "";
    const text = [`📢 ${title}`, message, parsed.link ? `🔗 ${parsed.link}` : null].filter(Boolean).join("\n");
    const users = await db.user.findMany({
      where: {
        OR: [
          ...(parsed.targetUserId ? [{ id: parsed.targetUserId }] : []),
          ...(parsed.targetKaryawanId ? [{ karyawan: { id: parsed.targetKaryawanId } }] : []),
        ],
        telegramChatId: { not: null },
      },
      select: { telegramChatId: true, telegramNotifPrefs: true },
    });
    if (users.length === 0) return;
    const cfg = await getTelegramConfig({ tenantId });
    for (const u of users) {
      if (!u.telegramChatId) continue;
      // Only deliver if the user hasn't disabled this notification type in Telegram.
      const prefs = normalizeNotifPrefs(u.telegramNotifPrefs);
      if (prefs[type] === false) continue;
      await sendTelegramMessage(u.telegramChatId, text, cfg);
    }
  } catch {
    // Telegram delivery must never break the in-app notification.
  }
}

/** My inbox — notifications addressed to me (by user or my karyawan id). */
export async function myNotifications() {
  const user = await requireRole();
  const rows = await db.logAktivitas.findMany({
    where: { aksi: "NOTIFICATION" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows
    .map((r) => {
      try {
        const d = JSON.parse(r.detail ?? "{}");
        const isMine =
          (d.targetUserId && d.targetUserId === user.id) ||
          (d.targetKaryawanId && user.karyawanId && d.targetKaryawanId === user.karyawanId);
        return isMine ? { id: r.id, createdAt: r.createdAt, ...d } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ---------- T34: Permission admin ----------

export async function permissionMatrix() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN_OPERASIONAL");
  return {
    roles: Object.keys(PERMISSIONS),
    permissions: PERMISSIONS,
  };
}

export async function userPermissionsInfo() {
  const user = await requireRole();
  return { role: user.role, permissions: PERMISSIONS[user.role] ?? [] };
}

// ---------- T36: Hardening helpers ----------

/** List recent audit entries (super-set of legacy xRayLog read). */
export async function auditTrail(limit = 200, aksi?: string) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN_OPERASIONAL");
  return db.logAktivitas.findMany({
    where: aksi ? { aksi } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { email: true } } },
  });
}

/** Health summary used by the admin console. */
export async function systemHealth() {
  await requireRole("SUPER_ADMIN", "ADMIN_OPERASIONAL");
  const [users, tenants, karyawan, [jadwal, absensi, payroll]] = await Promise.all([
    db.user.count(),
    db.tenant.count(),
    db.karyawan.count(),
    Promise.all([db.jadwal.count(), db.absensi.count(), db.payroll.count()]),
  ]);
  return { users, tenants, karyawan, jadwal, absensi, payroll };
}