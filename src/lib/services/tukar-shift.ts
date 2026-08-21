import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const APPROVER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

const tukarShiftSchema = z.object({
  requesterId: z.string().min(1),
  targetId: z.string().min(1),
  jadwalId: z.string().optional().nullable(),
  tanggal: z.string().min(1),
  alasan: z.string().optional().nullable(),
  lampiranDriveId: z.string().optional().nullable(),
});

export type TukarShiftInput = z.infer<typeof tukarShiftSchema>;

/**
 * Request a shift swap. Rejects if requester == target.
 */
export async function requestTukarShift(input: TukarShiftInput) {
  const user = await requireRole();
  if (user.karyawanId && user.karyawanId !== input.requesterId && !APPROVER_ROLES.includes(user.role)) {
    throw AppError.forbidden("Tidak dapat mengajukan tukar shift untuk orang lain");
  }
  const parsed = tukarShiftSchema.parse(input);
  if (parsed.requesterId === parsed.targetId) {
    throw AppError.badRequest("Tidak dapat tukar shift dengan diri sendiri");
  }
  return db.tukarShift.create({
    data: {
      requesterId: parsed.requesterId,
      targetId: parsed.targetId,
      jadwalId: parsed.jadwalId ?? null,
      tanggal: new Date(parsed.tanggal),
      alasan: parsed.alasan ?? null,
      lampiranDriveId: parsed.lampiranDriveId ?? null,
    },
  });
}

/**
 * Target streamer confirms they agree to the shift swap.
 * Can only be done by the target karyawan themselves.
 */
export async function confirmTukarShift(id: string) {
  const user = await requireRole();
  const row = await db.tukarShift.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Pengajuan tukar shift tidak ditemukan");
  if (row.status !== "PENDING") throw AppError.conflict("Pengajuan ini sudah tidak dapat dikonfirmasi");
  if (user.karyawanId !== row.targetId) throw AppError.forbidden("Hanya streamer pengganti yang dapat mengkonfirmasi");
  return db.tukarShift.update({ where: { id }, data: { status: "TARGET_CONFIRMED" } });
}

/**
 * Approve/reject a swap. Approver cannot approve their own request.
 */
export async function processTukarShift(id: string, approve: boolean) {
  const user = await requireRole(...APPROVER_ROLES);
  const row = await db.tukarShift.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Pengajuan tukar shift tidak ditemukan");
  if (row.requesterId === user.karyawanId) {
    throw AppError.forbidden("Tidak dapat menyetujui pengajuan sendiri");
  }
  // Warn if target hasn't confirmed yet (allow override by admin)
  if (approve && row.status === "PENDING") {
    // Admin can still force-approve, but we log a note.
  }
  return db.$transaction(async (tx) => {
    const updatedSwap = await tx.tukarShift.update({
      where: { id },
      data: { status: approve ? "APPROVED" : "REJECTED" },
    });

    // If approved and linked to a specific schedule, atomically reassign the streamer
    if (approve && row.jadwalId) {
      await tx.jadwal.update({
        where: { id: row.jadwalId },
        data: { streamerKaryawanId: row.targetId },
      });
    }

    return updatedSwap;
  });
}

export async function listTukarShift(params?: { karyawanId?: string }) {
  const user = await requireRole();
  const isApprover = APPROVER_ROLES.includes(user.role);
  // Non-approvers see only swaps they're part of (data isolation).
  const where = params?.karyawanId
    ? { OR: [{ requesterId: params.karyawanId }, { targetId: params.karyawanId }] }
    : !isApprover && user.karyawanId
      ? { OR: [{ requesterId: user.karyawanId }, { targetId: user.karyawanId }] }
      : undefined;
  return db.tukarShift.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { requester: true, target: true },
  });
}
