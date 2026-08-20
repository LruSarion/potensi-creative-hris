import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL"];

const suaraSchema = z.object({
  kategori: z.string().optional().nullable(),
  pesan: z.string().min(1),
  lampiranDriveId: z.string().optional().nullable(),
});

export type SuaraInput = z.infer<typeof suaraSchema>;

/**
 * Submit anonymous feedback. Submitter identity is NOT stored —
 * this preserves anonymity at the data layer.
 */
export async function submitSuara(input: SuaraInput) {
  await requireRole();
  const parsed = suaraSchema.parse(input);
  return db.logAktivitas.create({
    data: {
      aksi: "SUARA_KARYAWAN",
      detail: JSON.stringify({
        kategori: parsed.kategori ?? null,
        pesan: parsed.pesan,
        lampiranDriveId: parsed.lampiranDriveId ?? null,
      }),
    },
  });
}

/**
 * List feedback (admin only). Returns only content — no submitter identity.
 */
export async function listSuara() {
  await requireRole(...ADMIN_ROLES);
  const rows = await db.logAktivitas.findMany({
    where: { aksi: "SUARA_KARYAWAN" },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .map((r) => {
      try {
        const d = JSON.parse(r.detail ?? "{}");
        return {
          id: r.id,
          createdAt: r.createdAt,
          kategori: d.kategori ?? null,
          pesan: d.pesan ?? "",
          lampiranDriveId: d.lampiranDriveId ?? null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
