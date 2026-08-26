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

async function pushTelegramForTarget(parsed: z.infer<typeof notifySchema>, tenantId?: string) {
  try {
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

/** My inbox — notifications addressed to me (by user, karyawan id, or role). */
export async function myNotifications() {
  const user = await requireRole();
  const rows = await db.logAktivitas.findMany({
    where: { aksi: "NOTIFICATION" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const notifs = rows
    .map((r) => {
      try {
        const d = JSON.parse(r.detail ?? "{}");
        const isMine =
          (d.targetUserId && d.targetUserId === user.id) ||
          (d.targetKaryawanId && user.karyawanId && d.targetKaryawanId === user.karyawanId) ||
          (d.targetRole && (d.targetRole === "ALL" || d.targetRole === user.role)) ||
          (!d.targetUserId && !d.targetKaryawanId && !d.targetRole && user.role === "SUPER_ADMIN");

        if (!isMine) return null;

        return {
          id: r.id,
          createdAt: r.createdAt,
          title: d.title || "Pemberitahuan Sistem",
          message: d.message || null,
          link: d.link || null,
          type: d.type || "INFO",
          isRead: Boolean(d.read || d.isRead),
          readAt: d.readAt || null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return notifs;
}

/** Mark a single notification as read */
export async function markNotificationRead(id: string) {
  const user = await requireRole();
  const row = await db.logAktivitas.findUnique({ where: { id } });
  if (!row || row.aksi !== "NOTIFICATION") return { success: false, message: "Notifikasi tidak ditemukan." };

  try {
    const d = JSON.parse(row.detail ?? "{}");
    d.read = true;
    d.isRead = true;
    d.readAt = new Date().toISOString();

    await db.logAktivitas.update({
      where: { id },
      data: { detail: JSON.stringify(d) },
    });
    return { success: true, id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Mark all notifications for the current user as read */
export async function markAllNotificationsRead() {
  const user = await requireRole();
  const rows = await db.logAktivitas.findMany({
    where: { aksi: "NOTIFICATION" },
    take: 100,
  });

  const toUpdate = rows.filter((r) => {
    try {
      const d = JSON.parse(r.detail ?? "{}");
      const isMine =
        (d.targetUserId && d.targetUserId === user.id) ||
        (d.targetKaryawanId && user.karyawanId && d.targetKaryawanId === user.karyawanId) ||
        (d.targetRole && (d.targetRole === "ALL" || d.targetRole === user.role)) ||
        (!d.targetUserId && !d.targetKaryawanId && !d.targetRole && user.role === "SUPER_ADMIN");
      return isMine && !d.read && !d.isRead;
    } catch {
      return false;
    }
  });

  await Promise.all(
    toUpdate.map(async (r) => {
      try {
        const d = JSON.parse(r.detail ?? "{}");
        d.read = true;
        d.isRead = true;
        d.readAt = new Date().toISOString();
        return db.logAktivitas.update({
          where: { id: r.id },
          data: { detail: JSON.stringify(d) },
        });
      } catch {
        return null;
      }
    })
  );

  return { success: true, count: toUpdate.length };
}

/** Delete a single notification */
export async function deleteNotification(id: string) {
  const user = await requireRole();
  const row = await db.logAktivitas.findUnique({ where: { id } });
  if (!row || row.aksi !== "NOTIFICATION") return { success: false, message: "Notifikasi tidak ditemukan." };

  await db.logAktivitas.delete({ where: { id } });
  return { success: true, id };
}

/** Clear / delete all notifications for the current user */
export async function clearAllNotifications() {
  const user = await requireRole();
  const rows = await db.logAktivitas.findMany({
    where: { aksi: "NOTIFICATION" },
    take: 200,
  });

  const toDeleteIds = rows
    .filter((r) => {
      try {
        const d = JSON.parse(r.detail ?? "{}");
        return (
          (d.targetUserId && d.targetUserId === user.id) ||
          (d.targetKaryawanId && user.karyawanId && d.targetKaryawanId === user.karyawanId) ||
          (d.targetRole && (d.targetRole === "ALL" || d.targetRole === user.role)) ||
          (!d.targetUserId && !d.targetKaryawanId && !d.targetRole && user.role === "SUPER_ADMIN")
        );
      } catch {
        return false;
      }
    })
    .map((r) => r.id);

  if (toDeleteIds.length > 0) {
    await db.logAktivitas.deleteMany({
      where: { id: { in: toDeleteIds } },
    });
  }

  return { success: true, count: toDeleteIds.length };
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