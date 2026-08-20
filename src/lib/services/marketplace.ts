import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import { createJadwalBatch, type JadwalInput } from "@/lib/services/jadwal";
import type { Role } from "@/generated/prisma/enums";

const WRITE_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "CLIENT"];

/**
 * Batch import jadwal (streamer/OTS). Atomic — delegates to createJadwalBatch
 * which runs in a $transaction (all-or-nothing).
 */
export async function importJadwalBatch(rows: JadwalInput[]) {
  await requireRole(...WRITE_ROLES);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw AppError.badRequest("Batch kosong atau format salah");
  }
  const created = await createJadwalBatch(rows);
  return { imported: created.length };
}

/**
 * Marketplace overview: approved/online/cleaning products grouped by status.
 */
export async function getMarketplaceOverview() {
  await requireRole();
  const produk = await db.produk.findMany({ include: { client: true } });
  const byStatus = produk.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  return { total: produk.length, byStatus };
}
