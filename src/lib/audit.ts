import { db } from "@/lib/db";

/**
 * Persist an audit log entry (superset of the legacy xRayLog).
 * Never logs sensitive payloads — only action + safe detail.
 */
export async function logAktivitas(params: {
  userId?: string | null;
  tenantId?: string | null;
  aksi: string;
  detail?: string;
  ip?: string;
}) {
  try {
    await db.logAktivitas.create({
      data: {
        userId: params.userId ?? null,
        tenantId: params.tenantId ?? null,
        aksi: params.aksi,
        detail: params.detail ?? null,
        ip: params.ip ?? null,
      },
    });
  } catch (e) {
    // Audit logging must never break the main flow.
    console.error("Failed to write audit log:", e);
  }
}
