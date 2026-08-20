import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";

/**
 * Attachment service — abstraction over storage backends.
 * Today: Google Drive reference storage (Drive stays the source of files).
 * Interface is S3-ready: swap `storage.upload` for an S3 client when deployed.
 */

export type StorageBackend = "drive" | "s3";

export interface StorageProvider {
  backend: StorageBackend;
  upload(params: { bucket: string; key: string; content: Buffer; mime: string }): Promise<{ refId: string; url: string }>;
  getPublicUrl(bucket: string, refId: string): string;
}

/** Default bucket map (superset of legacy FOLDER_ID buckets). */
export const ATTACHMENT_BUCKETS = {
  ABSENSI: "BUKTI_ABSENSI",
  LEMBUR: "BUKTI_LEMBUR",
  WAIVER: "LAMPIRAN_WAIVER",
  CUTI_IZIN: "LAMPIRAN_CUTI_IZIN",
  SUARA: "LAMPIRAN_SUARA_KARYAWAN",
  TUKAR_SHIFT: "LAMPIRAN_TUKAR_SHIFT_STREAMER",
  LEGALITAS: "ARSIP_LEGALITAS",
  JADWAL: "BERKAS_JADWAL_HRIS",
  COURSE_CONTENT: "LMS_COURSE_CONTENT",
  RECORDING: "QC_RECORDINGS",
  CERTIFICATE: "CERTIFICATES",
} as const;

export type AttachmentBucket = keyof typeof ATTACHMENT_BUCKETS;
export type AttachmentKind = AttachmentBucket; // compatible alias

const attachSchema = z.object({
  kind: z.enum(Object.keys(ATTACHMENT_BUCKETS) as [string, ...string[]]),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  refId: z.string().min(1),
  url: z.string().optional().nullable(),
  mime: z.string().optional().nullable(),
  size: z.number().int().nonnegative().optional().nullable(),
  name: z.string().optional().nullable(),
  tenantId: z.string().optional().nullable(),
});

export type AttachmentInput = z.infer<typeof attachSchema>;

/**
 * Drive-backed provider. Uploads are NOT performed (Drive remains the file home);
 * callers pass a Drive file id as refId. Kept S3-ready by contract shape.
 */
export const driveProvider: StorageProvider = {
  backend: "drive",
  async upload({ bucket, key, content, mime }) {
    // Drive integration point: `Drive.Files.create({..., uploadType:'multipart'})`
    // would use (key, content, mime). For now we return a placeholder ref so the
    // pipeline is exercisable; real Drive write is wired in deployment.
    return { refId: key, url: `drive://${bucket}/${key}` };
  },
  getPublicUrl(_bucket, refId) {
    return `https://drive.google.com/file/d/${refId}/view`;
  },
};

let activeProvider: StorageProvider = driveProvider;

/** Switch backend (S3 when deployed). */
export function setStorageProvider(p: StorageProvider) {
  activeProvider = p;
}

export function getStorageProvider(): StorageProvider {
  return activeProvider;
}

/**
 * Store an attachment reference (metadata + storage ref) for an entity.
 * Writes a real Attachment row so the file is discoverable across portals.
 */
export async function storeAttachment(input: AttachmentInput) {
  const user = await requireRole();
  if (!user.tenantId && input.tenantId == null) {
    throw AppError.forbidden("Akun tidak terkait tenant");
  }
  const parsed = attachSchema.parse(input);
  const tenantId = input.tenantId ?? user.tenantId;
  return db.attachment.create({
    data: {
      tenantId: tenantId ?? null,
      kind: parsed.kind,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      refId: parsed.refId,
      url: parsed.url ?? null,
      mime: parsed.mime ?? null,
      size: parsed.size ?? null,
      name: parsed.name ?? null,
    },
  });
}

/** List attachments for an entity, tenant-scoped. */
export async function listAttachments(entityType: string, entityId: string) {
  const user = await requireRole();
  return db.attachment.findMany({
    where: {
      tenantId: user.role === "SUPER_ADMIN" ? undefined : user.tenantId || undefined,
      entityType,
      entityId,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** Resolve public URL for a stored ref (backend-aware). */
export function resolveAttachmentUrl(bucket: AttachmentBucket, refId: string): string {
  return activeProvider.getPublicUrl(ATTACHMENT_BUCKETS[bucket], refId);
}