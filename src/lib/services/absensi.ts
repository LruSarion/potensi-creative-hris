import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere } from "@/lib/auth-helpers";
import { recordStreamerExperienceOnSessionComplete } from "@/lib/services/streamer-experience";

const absensiSchema = z.object({
  karyawanId: z.string().min(1),
  jadwalId: z.string().optional().nullable(),
  kategori: z.enum(["STREAMER", "STAFF", "OTS"]),
  buktiDriveId: z.string().optional().nullable(),
  // Frontend sends "fotoBuktiUrl" — treat as the attendance photo proof.
  fotoBuktiUrl: z.string().optional().nullable(),
  catatan: z.string().optional().nullable(),
  reportedGmv: z.number().optional().nullable(),
  isTerusan: z.boolean().optional().default(false),
});

export type AbsensiInput = z.infer<typeof absensiSchema>;

/**
 * Check-in: creates a CHECK_IN record. Rejects if the karyawan already has an
 * open (un-checked-out) session. Automatically syncs Jadwal.liveState to LIVE.
 */
export async function checkIn(input: AbsensiInput) {
  const user = await requireRole();
  // Users default to checking in for themselves when no target is given.
  const targetKaryawanId = input.karyawanId || user.karyawanId;
  if (!targetKaryawanId) {
    throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  }
  // Users can only check in for themselves (or admins for others).
  if (
    user.karyawanId &&
    user.karyawanId !== targetKaryawanId &&
    !["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role)
  ) {
    throw AppError.forbidden("Tidak dapat absen untuk karyawan lain");
  }
  const parsed = absensiSchema.parse({ ...input, karyawanId: targetKaryawanId });
  parsed.jadwalId = parsed.jadwalId || null; // Fix empty string foreign key violation

  if (parsed.jadwalId && !parsed.isTerusan) {
    const j = await db.jadwal.findUnique({ where: { id: parsed.jadwalId } });
    if (j) {
      if (j.status === "SELESAI" || j.liveState === "CLOSED" || j.liveState === "REVIEW") {
        throw AppError.badRequest("Sesi jadwal ini sudah selesai dan tidak bisa di-check-in ulang.");
      }
      if (j.liveState === "LIVE") {
        throw AppError.badRequest("Jadwal ini sedang berjalan (ON AIR). Silakan lakukan check-out, bukan check-in.");
      }
      const sixtyMinsBefore = new Date(j.jamMulaiLive.getTime() - 60 * 60000);
      const now = new Date();
      if (now < sixtyMinsBefore) {
        throw AppError.badRequest("Terlalu dini. Check-In baru dibuka 60 menit sebelum sesi dimulai.");
      }
    }
  }

  // Duplicate active session check: an open CHECK_IN with no matching CHECK_OUT.
  const openCheckIn = await db.absensi.findFirst({
    where: {
      karyawanId: targetKaryawanId,
      tipe: "CHECK_IN",
      waktu: {
        gte: await lastCheckOutTime(targetKaryawanId),
      },
    },
    orderBy: { waktu: "desc" },
  });

  if (openCheckIn) {
    if (!parsed.isTerusan) {
      throw AppError.conflict("Sesi absensi masih aktif. Lakukan check-out terlebih dahulu atau pilih Absensi Terusan.");
    }
    // If isTerusan is true, we will automatically check out the open session in the transaction below
  }

  return db.$transaction(async (tx) => {
    // 1. Auto Check-Out for previous session if isTerusan
    if (openCheckIn && parsed.isTerusan) {
      await tx.absensi.create({
        data: {
          tenantId: user.tenantId ?? undefined,
          karyawanId: targetKaryawanId,
          jadwalId: openCheckIn.jadwalId,
          tipe: "CHECK_OUT",
          kategori: openCheckIn.kategori,
          catatan: "Auto Check-Out (Absensi Terusan)",
          reportedGmv: null, // Streamer must fill this later
        },
      });

      if (openCheckIn.jadwalId) {
        const j = await tx.jadwal.findUnique({ where: { id: openCheckIn.jadwalId } });
        if (j && (j.liveState === "LIVE" || j.liveState === "SCHEDULED")) {
          const checkOutTime = new Date();
          const durationSec = Math.floor((checkOutTime.getTime() - openCheckIn.waktu.getTime()) / 1000);
          
          await tx.jadwal.update({
            where: { id: openCheckIn.jadwalId },
            data: { 
              liveState: "REVIEW", 
              status: "SELESAI",
              durationSec: Math.max(0, durationSec)
            },
          });
          await tx.sessionStateLog.create({
            data: {
              tenantId: user.tenantId ?? undefined,
              jadwalId: openCheckIn.jadwalId,
              fromState: j.liveState,
              toState: "REVIEW",
              changedById: user.id,
              note: "Auto-transition on Terusan Check-In",
            },
          });
        }
      }
    }

    // 2. Create the new Check-In record
    const record = await tx.absensi.create({
      data: {
        tenantId: user.tenantId ?? undefined,
        karyawanId: targetKaryawanId,
        jadwalId: parsed.jadwalId ?? null,
        tipe: "CHECK_IN",
        kategori: parsed.kategori,
        buktiDriveId: parsed.buktiDriveId ?? parsed.fotoBuktiUrl ?? null,
        catatan: parsed.catatan ?? null,
        isTerusan: parsed.isTerusan,
      },
    });

    // If linked to a schedule, update liveState to LIVE
    if (parsed.jadwalId) {
      const j = await tx.jadwal.findUnique({ where: { id: parsed.jadwalId } });
      if (j && j.liveState === "SCHEDULED") {
        await tx.jadwal.update({
          where: { id: parsed.jadwalId },
          data: { liveState: "LIVE" },
        });
        await tx.sessionStateLog.create({
          data: {
            tenantId: user.tenantId ?? undefined,
            jadwalId: parsed.jadwalId,
            fromState: "SCHEDULED",
            toState: "LIVE",
            changedById: user.id,
            note: "Auto-transition on Check-In",
          },
        });
      }
    }

    return record;
  });
}

/**
 * Check-out: creates a CHECK_OUT record. Requires an open CHECK_IN.
 * Automatically syncs Jadwal.liveState to REVIEW/CLOSED.
 */
export async function checkOut(input: AbsensiInput) {
  const user = await requireRole();
  // Users default to checking out for themselves when no target is given.
  const targetKaryawanId = input.karyawanId || user.karyawanId;
  if (!targetKaryawanId) {
    throw AppError.forbidden("Akun tidak terhubung ke karyawan");
  }
  if (
    user.karyawanId &&
    user.karyawanId !== targetKaryawanId &&
    !["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role)
  ) {
    throw AppError.forbidden("Tidak dapat absen untuk karyawan lain");
  }
  const parsed = absensiSchema.parse({ ...input, karyawanId: targetKaryawanId });
  parsed.jadwalId = parsed.jadwalId || null; // Fix empty string foreign key violation

  const lastCheckIn = await db.absensi.findFirst({
    where: { karyawanId: targetKaryawanId, tipe: "CHECK_IN" },
    orderBy: { waktu: "desc" },
  });
  if (!lastCheckIn) {
    throw AppError.badRequest("Belum ada check-in untuk karyawan ini.");
  }

  return db.$transaction(async (tx) => {
    const record = await tx.absensi.create({
      data: {
        tenantId: user.tenantId ?? undefined,
        karyawanId: targetKaryawanId,
        jadwalId: parsed.jadwalId ?? lastCheckIn.jadwalId ?? null,
        tipe: "CHECK_OUT",
        kategori: parsed.kategori,
        buktiDriveId: parsed.buktiDriveId ?? parsed.fotoBuktiUrl ?? null,
        catatan: parsed.catatan ?? null,
        reportedGmv: parsed.reportedGmv ?? null,
      },
    });

    // If linked to a schedule, update liveState to REVIEW/CLOSED
    const targetJadwalId = parsed.jadwalId ?? lastCheckIn.jadwalId;
    if (targetJadwalId) {
      const j = await tx.jadwal.findUnique({ where: { id: targetJadwalId } });
      if (j && (j.liveState === "LIVE" || j.liveState === "SCHEDULED")) {
        const checkOutTime = new Date();
        const durationSec = Math.floor((checkOutTime.getTime() - lastCheckIn.waktu.getTime()) / 1000);
        
        await tx.jadwal.update({
          where: { id: targetJadwalId },
          data: { 
            liveState: "REVIEW", 
            status: "SELESAI",
            durationSec: Math.max(0, durationSec)
          },
        });
        await tx.sessionStateLog.create({
          data: {
            tenantId: user.tenantId ?? undefined,
            jadwalId: targetJadwalId,
            fromState: j.liveState,
            toState: "REVIEW",
            changedById: user.id,
            note: "Auto-transition on Check-Out (Session Finished)",
          },
        });
      }
    }

    return record;
  }).then(async (record) => {
    // Auto-record the completed session in the streamer's experience portfolio.
    const jadwalId = parsed.jadwalId ?? lastCheckIn.jadwalId;
    if (jadwalId) {
      await recordStreamerExperienceOnSessionComplete(jadwalId).catch(() => {
        // non-fatal
      });
    }
    return record;
  });
}

/** Time of the most recent CHECK_OUT for a karyawan (or epoch if none). */
export async function lastCheckOutTime(karyawanId: string): Promise<Date> {
  const last = await db.absensi.findFirst({
    where: { karyawanId, tipe: "CHECK_OUT" },
    orderBy: { waktu: "desc" },
  });
  return last ? last.waktu : new Date(0);
}

export async function listAbsensi(params?: { karyawanId?: string }) {
  const user = await requireRole();
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role);
  // Non-admins see only their own attendance (data isolation).
  const where: Record<string, unknown> = { ...tenantWhere(user) };
  if (params?.karyawanId) where.karyawanId = params.karyawanId;
  else if (!isAdmin && user.karyawanId) where.karyawanId = user.karyawanId;
  return db.absensi.findMany({
    where,
    orderBy: { waktu: "desc" },
    include: { karyawan: true, jadwal: true },
  });
}

export async function updateGmv(id: string, reportedGmv: number) {
  const user = await requireRole();
  const absensi = await db.absensi.findUnique({ where: { id } });
  if (!absensi) throw AppError.notFound("Data absensi tidak ditemukan");
  
  if (absensi.karyawanId !== user.karyawanId && !["SUPER_ADMIN", "ADMIN_OPERASIONAL"].includes(user.role)) {
    throw AppError.forbidden("Tidak bisa mengubah data absensi orang lain");
  }

  return db.absensi.update({
    where: { id },
    data: { reportedGmv }
  });
}

/** Active (open) session for a karyawan, if any. */
export async function getSesiAktif(karyawanId: string) {
  const user = await requireRole();
  // Non-admins may only query their own active session.
  const isAdmin = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "OPERATION"].includes(user.role);
  if (!isAdmin && user.karyawanId && user.karyawanId !== karyawanId) {
    throw AppError.forbidden("Tidak dapat melihat sesi karyawan lain");
  }
  const lastCheckIn = await db.absensi.findFirst({
    where: { karyawanId, tipe: "CHECK_IN" },
    orderBy: { waktu: "desc" },
  });
  if (!lastCheckIn) return null;
  const lastCheckOut = await db.absensi.findFirst({
    where: { karyawanId, tipe: "CHECK_OUT" },
    orderBy: { waktu: "desc" },
  });
  if (lastCheckOut && lastCheckOut.waktu > lastCheckIn.waktu) return null;
  return lastCheckIn;
}
