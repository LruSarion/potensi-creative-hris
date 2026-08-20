import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";

/**
 * Record type -> Drive folder bucket mapping (from legacy Config.gs FOLDER_ID).
 * We store Drive IDs only; actual upload to Drive is out of scope for now.
 */
export const DRIVE_BUCKETS = {
  ABSENSI: "BUKTI_ABSENSI",
  LEMBUR: "BUKTI_LEMBUR",
  WAIVER: "LAMPIRAN_WAIVER",
  CUTI_IZIN: "LAMPIRAN_CUTI_IZIN",
  SUARA_KARYAWAN: "LAMPIRAN_SUARA_KARYAWAN",
  TUKAR_SHIFT: "LAMPIRAN_TUKAR_SHIFT_STREAMER",
  KTP: "ARSIP_LEGALITAS",
  KK: "ARSIP_LEGALITAS",
  NPWP: "ARSIP_LEGALITAS",
  JADWAL: "BERKAS_JADWAL_HRIS",
} as const;

export type DriveBucket = keyof typeof DRIVE_BUCKETS;

const refSchema = z.object({
  recordType: z.enum(Object.keys(DRIVE_BUCKETS) as [string, ...string[]]),
  entityId: z.string().min(1),
  driveId: z.string().min(1),
  name: z.string().optional().nullable(),
});

export type DriveRefInput = z.infer<typeof refSchema>;

/**
 * Store a Drive reference (drive_id + metadata) for a record.
 * Note: does NOT upload to Drive — Drive is kept as the storage backend for now.
 */
export async function storeDriveReference(input: DriveRefInput) {
  await requireRole();
  const parsed = refSchema.parse(input);
  const recordType = parsed.recordType as DriveBucket;
  // Persist as an audit-style record in LogAktivitas with a structured detail,
  // since we don't have a dedicated attachment table yet.
  await db.logAktivitas.create({
    data: {
      aksi: `ATTACH_${recordType}`,
      detail: JSON.stringify({
        entityId: parsed.entityId,
        driveId: parsed.driveId,
        name: parsed.name ?? null,
        bucket: DRIVE_BUCKETS[recordType],
      }),
    },
  });
  return { stored: true, bucket: DRIVE_BUCKETS[recordType], driveId: parsed.driveId };
}

/**
 * Retrieve Drive references for a record type + entity.
 */
export async function getDriveReferences(recordType: DriveBucket, entityId: string) {
  await requireRole();
  const rows = await db.logAktivitas.findMany({
    where: { aksi: `ATTACH_${recordType}` },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .map((r) => {
      try {
        const d = JSON.parse(r.detail ?? "{}");
        return d.entityId === entityId ? d : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** Resolve the folder bucket name for a record type. */
export function bucketFor(recordType: DriveBucket): string {
  return DRIVE_BUCKETS[recordType];
}
